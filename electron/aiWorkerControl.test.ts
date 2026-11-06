import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { describe, it } from 'node:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  acquireWorkerClaim,
  AiWorkerController,
  DEFAULT_IDLE_MS,
  DEFAULT_STARTUP_MS,
  localPortBusy,
  PORT_IN_USE_MESSAGE,
  releaseWorkerClaim,
  REUSE_PROBE_MS,
  updateWorkerClaim,
  workerClaimHeld,
  workerClaimPath,
  type OwnedProcess,
  type WorkerProbe,
  type WorkerSession,
} from './aiWorkerControl.js'

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('AI worker lifecycle', () => {
  it('keeps the production idle delay at 120 seconds', () => {
    assert.equal(DEFAULT_IDLE_MS, 120_000)
    assert.equal(DEFAULT_STARTUP_MS, 90_000)
    assert.equal(REUSE_PROBE_MS, 20_000)
  })

  it('does not start a worker while only checking health', async () => {
    let spawned = 0
    const worker = controller({
      probe: async () => ({ state: 'down' }),
      spawn: () => {
        spawned += 1
        return liveProcess()
      },
    })
    const health = await worker.health()
    assert.equal(health.ready, true)
    assert.equal(spawned, 0)
    await worker.shutdown()
  })

  it('refuses to start without speaker consent', async () => {
    let spawned = 0
    const worker = controller({
      probe: async () => ({ state: 'down' }),
      spawn: () => {
        spawned += 1
        return liveProcess()
      },
    })
    await assert.rejects(
      () => worker.run(false, async () => 'nope'),
      /permission/i,
    )
    assert.equal(spawned, 0)
    await worker.shutdown()
  })

  it('starts one worker and reuses it for a second request', async () => {
    let spawned = 0
    let alive = false
    const worker = controller({
      probe: async () => (alive ? { state: 'ready', model: 'Qwen3-TTS-0.6B' } : { state: 'down' }),
      spawn: () => {
        spawned += 1
        alive = true
        return liveProcess(() => {
          alive = false
        })
      },
    })
    assert.equal(await worker.run(true, async () => 'one'), 'one')
    assert.equal(await worker.run(true, async () => 'two'), 'two')
    assert.equal(spawned, 1)
    assert.equal(worker.status().owned, true)
    await worker.shutdown()
    assert.equal(alive, false)
  })

  it('reports loading only when a worker has to start', async () => {
    let spawned = 0
    let alive = false
    const loads: string[] = []
    const worker = controller({
      probe: async () => (alive ? { state: 'ready', model: 'Qwen3-TTS-0.6B' } : { state: 'down' }),
      spawn: () => {
        spawned += 1
        alive = true
        return liveProcess(() => {
          alive = false
        })
      },
    })
    await worker.run(true, async () => 'cold', { onLoading: () => loads.push('cold') })
    await worker.run(true, async () => 'warm', { onLoading: () => loads.push('warm') })
    assert.equal(spawned, 1)
    assert.deepEqual(loads, ['cold'])
    await worker.shutdown()
  })

  it('does not unload while a request is active', async () => {
    let alive = false
    const worker = controller({
      idleMs: 30,
      probe: async () => (alive ? { state: 'ready', model: 'Qwen3-TTS-0.6B' } : { state: 'down' }),
      spawn: () => {
        alive = true
        return liveProcess(() => {
          alive = false
        })
      },
    })
    const pending = worker.run(true, () => wait(80))
    await wait(50)
    assert.equal(alive, true)
    await pending
    await wait(50)
    assert.equal(alive, false)
  })

  it('reloads after the idle shutdown', async () => {
    let spawned = 0
    let alive = false
    const worker = controller({
      idleMs: 30,
      probe: async () => (alive ? { state: 'ready', model: 'Qwen3-TTS-0.6B' } : { state: 'down' }),
      spawn: () => {
        spawned += 1
        alive = true
        return liveProcess(() => {
          alive = false
        })
      },
    })
    await worker.run(true, async () => undefined)
    await wait(50)
    assert.equal(worker.status().owned, false)
    await worker.run(true, async () => undefined)
    assert.equal(spawned, 2)
    await worker.shutdown()
  })

  it('starts again after the worker crashes', async () => {
    let spawned = 0
    let alive = false
    let crash: () => void = () => {}
    const worker = controller({
      probe: async () => (alive ? { state: 'ready', model: 'Qwen3-TTS-0.6B' } : { state: 'down' }),
      spawn: () => {
        spawned += 1
        alive = true
        const proc = liveProcess(() => {
          alive = false
        })
        crash = proc.kill
        return proc
      },
    })
    await worker.run(true, async () => undefined)
    crash()
    await wait(10)
    await worker.run(true, async () => undefined)
    assert.equal(spawned, 2)
    await worker.shutdown()
  })

  it('does not send audio to an unrelated process that mimics the API', async () => {
    const impostor = await listenImpostor()
    let probed = 0
    let spawned = 0
    let operations = 0
    const worker = new AiWorkerController({
      canStart: () => true,
      portBusy: () => localPortBusy(impostor.port),
      probe: async () => {
        probed += 1
        return { state: 'ready', model: 'Qwen3-TTS-0.6B' }
      },
      spawn: () => {
        spawned += 1
        return liveProcess()
      },
    })
    try {
      const health = await worker.health()
      assert.equal(health.ready, false)
      assert.equal(health.message, PORT_IN_USE_MESSAGE)
      await assert.rejects(
        () => worker.run(true, async () => {
          operations += 1
        }),
        /will not send your recording/i,
      )
      assert.equal(probed, 0)
      assert.equal(spawned, 0)
      assert.equal(operations, 0)
      assert.equal(impostor.requests, 0)
      assert.equal(worker.status().owned, false)
    } finally {
      await worker.shutdown()
      await impostor.close()
    }
  })

  it('gives the recording only to the worker it started', async () => {
    let spawnedToken = ''
    let probedToken = ''
    const worker = controller({
      probe: async (token) => {
        probedToken = token
        return spawnedToken
          ? { state: 'ready', model: 'Qwen3-TTS-0.6B' }
          : { state: 'down' }
      },
      spawn: (token) => {
        spawnedToken = token
        return liveProcess()
      },
    })
    let session: WorkerSession | undefined
    await worker.run(true, async (current) => {
      session = current
    })
    assert.equal(session?.token, spawnedToken)
    assert.equal(probedToken, spawnedToken)
    assert.equal(session?.url, 'http://127.0.0.1:8765')
    assert.ok(spawnedToken.length >= 32)
    await worker.shutdown()
  })

  it('does not call its own starting engine another program', async () => {
    let phase: 'free' | 'ours' | 'ready' = 'free'
    const worker = controller({
      startupMs: 2000,
      portBusy: async () => phase !== 'free',
      probe: async () =>
        phase === 'ready' ? { state: 'ready', model: 'Qwen3-TTS-0.6B' } : { state: 'down' },
      spawn: () => {
        phase = 'ours'
        return liveProcess()
      },
    })
    const pending = worker.run(true, async () => undefined)
    await wait(40)
    const health = await worker.health()
    assert.equal(health.ready, false)
    assert.match(health.message ?? '', /still starting/i)
    assert.equal(health.message === PORT_IN_USE_MESSAGE, false)
    phase = 'ready'
    await pending
    await worker.shutdown()
  })

  it('does not start a second model when the port is already taken', async () => {
    let spawned = 0
    let probed = 0
    const worker = controller({
      portBusy: async () => true,
      probe: async () => {
        probed += 1
        return { state: 'ready', model: 'Qwen3-TTS-0.6B' }
      },
      spawn: () => {
        spawned += 1
        return liveProcess()
      },
    })
    const health = await worker.health()
    assert.equal(health.ready, false)
    await assert.rejects(() => worker.run(true, async () => undefined), /will not stop that program/i)
    assert.equal(spawned, 0)
    assert.equal(probed, 0)
    await worker.shutdown()
  })

  it('reports a Windows memory failure when the model cannot be loaded', async () => {
    const holder: { worker?: AiWorkerController } = {}
    const exit = deferred<number | null>()
    const logs: string[] = []
    holder.worker = new AiWorkerController({
      canStart: () => true,
      portBusy: async () => false,
      probe: async () => ({ state: 'down' }),
      log: (line) => logs.push(line),
      spawn: () => {
        holder.worker?.remember('OSError: The paging file is too small for this operation to complete. (os error 1455)')
        queueMicrotask(() => exit.resolve(1))
        return { pid: 9, exited: exit.promise, kill: () => exit.resolve(1) }
      },
    })
    const worker = holder.worker
    await assert.rejects(
      () => worker.run(true, async () => undefined),
      /ran out of memory[\s\S]*virtual-memory settings/i,
    )
    assert.ok(logs.some((line) => line.startsWith('memory:')))
    await worker.shutdown()
  })

  it('reports a GPU memory failure when startup exits', async () => {
    const holder: { worker?: AiWorkerController } = {}
    const exit = deferred<number | null>()
    holder.worker = new AiWorkerController({
      canStart: () => true,
      portBusy: async () => false,
      probe: async () => ({ state: 'down' }),
      spawn: () => {
        holder.worker?.remember('CUDA out of memory')
        queueMicrotask(() => exit.resolve(1))
        return { pid: 7, exited: exit.promise, kill: () => exit.resolve(1) }
      },
    })
    const worker = holder.worker
    await assert.rejects(() => worker.run(true, async () => undefined), /free memory/i)
    await worker.shutdown()
  })

  it('does not let the idle timer stop an active generation', async () => {
    let killed = 0
    let alive = false
    const worker = controller({
      idleMs: 20,
      probe: async () => (alive ? readyProbe() : { state: 'down' }),
      spawn: () => {
        alive = true
        return liveProcess(() => {
          killed += 1
          alive = false
        })
      },
    })
    const pending = worker.run(true, () => wait(120))
    await wait(70)
    assert.equal(killed, 0)
    assert.equal(worker.status().owned, true)
    await pending
    await wait(80)
    assert.equal(killed, 1)
    assert.equal(worker.status().owned, false)
  })

  it('reuses the worker for Generate Again', async () => {
    let spawned = 0
    let alive = false
    const worker = controller({
      probe: async () => (alive ? readyProbe() : { state: 'down' }),
      spawn: () => {
        spawned += 1
        alive = true
        return liveProcess(() => {
          alive = false
        })
      },
    })
    let first = ''
    let second = ''
    await worker.run(true, async (session) => {
      first = session.token
    })
    await worker.run(true, async (session) => {
      second = session.token
    })
    assert.equal(first, second)
    assert.equal(spawned, 1)
    assert.equal(worker.status().owned, true)
    await worker.shutdown()
  })

  it('serializes two generations that arrive together', async () => {
    let spawned = 0
    let alive = false
    let current = 0
    let max = 0
    const worker = controller({
      probe: async () => (alive ? readyProbe() : { state: 'down' }),
      spawn: () => {
        spawned += 1
        alive = true
        return liveProcess(() => {
          alive = false
        })
      },
    })
    const once = (name: string) => worker.run(true, async () => {
      current += 1
      max = Math.max(max, current)
      await wait(40)
      current -= 1
      return name
    })
    const results = await Promise.all([once('first'), once('again')])
    assert.deepEqual([...results].sort(), ['again', 'first'])
    assert.equal(max, 1)
    assert.equal(spawned, 1)
    await worker.shutdown()
  })

  it('does not start a second engine while startup is reserved', async () => {
    let spawned = 0
    const worker = controller({
      claim: async (): Promise<'held'> => 'held',
      probe: async () => ({ state: 'down' }),
      spawn: () => {
        spawned += 1
        return liveProcess()
      },
    })
    await assert.rejects(() => worker.run(true, async () => undefined), /will not stop that program/i)
    assert.equal(spawned, 0)
    assert.equal(worker.status().owned, false)
    await worker.shutdown()
  })

  it('keeps the worker after a failed generation and accepts the next one', async () => {
    let spawned = 0
    let alive = false
    const worker = controller({
      probe: async () => (alive ? readyProbe() : { state: 'down' }),
      spawn: () => {
        spawned += 1
        alive = true
        return liveProcess(() => {
          alive = false
        })
      },
    })
    await assert.rejects(() => worker.run(true, async () => {
      throw new Error('bad clip')
    }), /bad clip/)
    assert.equal(worker.status().owned, true)
    assert.equal(await worker.run(true, async () => 'recovered'), 'recovered')
    assert.equal(spawned, 1)
    await worker.shutdown()
  })

  it('does not replace a live worker when a health check fails', async () => {
    let spawned = 0
    let alive = false
    let respond = true
    let killed = 0
    const worker = controller({
      reuseMs: 30,
      probe: async () => (alive && respond ? readyProbe() : { state: 'down' }),
      spawn: () => {
        spawned += 1
        alive = true
        return liveProcess(() => {
          killed += 1
          alive = false
        })
      },
    })
    await worker.run(true, async () => 'ok')
    respond = false
    await assert.rejects(() => worker.run(true, async () => 'again'), /still working/i)
    assert.equal(spawned, 1)
    assert.equal(killed, 0)
    assert.equal(worker.status().owned, true)
    await worker.shutdown()
    assert.equal(killed, 1)
  })

  it('does not spawn or kill a worker reserved by another live process', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'slipup-claim-'))
    const holder = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    try {
      assert.ok(holder.pid)
      writeFileSync(workerClaimPath(dir), JSON.stringify({ ownerPid: holder.pid, workerPid: 0 }))
      assert.equal(workerClaimHeld(dir), true)
      assert.equal(acquireWorkerClaim(dir), 'held')
      assert.equal(holder.exitCode, null)
      let spawned = 0
      const worker = controller({
        probe: async () => ({ state: 'down' }),
        spawn: () => {
          spawned += 1
          return liveProcess()
        },
        claim: () => acquireWorkerClaim(dir),
        peekClaim: () => workerClaimHeld(dir),
      })
      const health = await worker.health()
      assert.equal(health.ready, false)
      assert.equal(health.message, PORT_IN_USE_MESSAGE)
      await assert.rejects(() => worker.run(true, async () => undefined), /will not send your recording/i)
      assert.equal(spawned, 0)
      assert.equal(holder.exitCode, null)
      await worker.shutdown()
      assert.equal(holder.exitCode, null)
    } finally {
      holder.kill()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('releases its own claim on shutdown and can take a stale one', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'slipup-claim-'))
    try {
      assert.equal(acquireWorkerClaim(dir), 'acquired')
      updateWorkerClaim(dir, process.pid)
      assert.equal(workerClaimHeld(dir), true)
      assert.equal(acquireWorkerClaim(dir), 'held')
      releaseWorkerClaim(dir)
      assert.equal(workerClaimHeld(dir), true)
      updateWorkerClaim(dir, 2_147_483_646)
      releaseWorkerClaim(dir)
      assert.equal(workerClaimHeld(dir), false)
      assert.equal(acquireWorkerClaim(dir), 'acquired')
      releaseWorkerClaim(dir)
      assert.equal(workerClaimHeld(dir), false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

function readyProbe(): WorkerProbe {
  return { state: 'ready', model: 'Qwen3-TTS-0.6B' }
}

function controller(hooks: {
  probe: (token: string) => Promise<WorkerProbe>
  spawn: (token: string) => OwnedProcess
  idleMs?: number
  startupMs?: number
  reuseMs?: number
  portBusy?: () => Promise<boolean>
  claim?: () => Promise<'acquired' | 'held'> | 'acquired' | 'held'
  releaseClaim?: () => void
  peekClaim?: () => Promise<boolean> | boolean
}): AiWorkerController {
  return new AiWorkerController({
    canStart: () => true,
    portBusy: hooks.portBusy ?? (async () => false),
    probe: hooks.probe,
    spawn: hooks.spawn,
    waitForReadyLine: false,
    idleMs: hooks.idleMs,
    startupMs: hooks.startupMs,
    reuseMs: hooks.reuseMs,
    claim: hooks.claim,
    releaseClaim: hooks.releaseClaim,
    peekClaim: hooks.peekClaim,
  })
}

function listenImpostor(): Promise<{ port: number; requests: number; close: () => Promise<void> }> {
  const state = { requests: 0 }
  const server = http.createServer((_request, response) => {
    state.requests += 1
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({
      status: 'ready',
      model: 'Qwen3-TTS-0.6B',
      authorized: true,
    }))
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        port,
        get requests() {
          return state.requests
        },
        close: () => new Promise((done, fail) => {
          server.close((error) => error ? fail(error) : done())
        }),
      })
    })
  })
}

function liveProcess(onKill?: () => void): OwnedProcess {
  const exit = deferred<number | null>()
  let killed = false
  return {
    pid: 100,
    exited: exit.promise,
    kill: () => {
      if (killed) return
      killed = true
      onKill?.()
      exit.resolve(0)
    },
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
