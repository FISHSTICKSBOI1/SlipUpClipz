import { graphsToCreate, microphoneTargets, type AudioRoutePlan } from './gamingAudioRouting.ts'

export type MicTarget = 'voice' | 'local'

/**
 * The Web Audio engine implements these steps.
 * Tests use a fake host so no microphone is opened.
 */
export interface AudioRouteHost {
  closeMicrophone(): Promise<void>
  closeVoice(): Promise<void>
  closeLocal(): Promise<void>
  createVoice(plan: AudioRoutePlan): Promise<void>
  createLocal(plan: AudioRoutePlan): Promise<void>
  setVoiceSink(plan: AudioRoutePlan): Promise<void>
  setLocalSink(plan: AudioRoutePlan): Promise<void>
  resumeVoice(): Promise<void>
  resumeLocal(): Promise<void>
  openMicrophone(plan: AudioRoutePlan): Promise<void>
  attachMicrophone(target: MicTarget): void
  /** Drop one tap. The capture stays open for the other graph. */
  detachMicrophone(target: MicTarget): void
}

export type RouteApplyResult = {
  ok: boolean
  restored: boolean
  message: string | null
  microphoneTargets: MicTarget[]
}

function failureMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Audio routing failed. The previous route was kept when it was still available.'
}

export function voiceRouteKey(plan: AudioRoutePlan): string {
  return JSON.stringify({
    mode: plan.mode,
    voiceSinkId: plan.voiceSinkId,
    voiceSinkExplicit: plan.voiceSinkExplicit,
    voiceMicrophone: plan.voiceMicrophone,
    voicePads: plan.voicePads,
    protectWithoutDucking: plan.protectWithoutDucking,
    microphoneDeviceId: plan.microphoneDeviceId,
  })
}

function localRouteKey(plan: AudioRoutePlan): string {
  return JSON.stringify({
    localEnabled: plan.localEnabled,
    localSinkId: plan.localSinkId,
    localSinkExplicit: plan.localSinkExplicit,
    localMicrophone: plan.localMicrophone,
    localPads: plan.localPads,
    protectWithoutDucking: plan.protectWithoutDucking,
  })
}

/**
 * Headphone monitoring can change without closing the voice-chat graph or
 * opening a second microphone. The capture already used for voice chat is tapped.
 */
async function applyLocalRouteUpdate(
  host: AudioRouteHost,
  plan: AudioRoutePlan,
  previous: AudioRoutePlan,
): Promise<RouteApplyResult> {
  const nextTargets = microphoneTargets(plan)
  const previousTargets = microphoneTargets(previous)
  const nextGraphs = graphsToCreate(plan)
  const previousGraphs = graphsToCreate(previous)
  const sinkChanged = plan.localSinkId !== previous.localSinkId
    || plan.localSinkExplicit !== previous.localSinkExplicit
    || plan.protectWithoutDucking !== previous.protectWithoutDucking
  try {
    let rebuiltLocal = false
    if (!nextGraphs.local) {
      if (previousTargets.includes('local')) host.detachMicrophone('local')
      await host.closeLocal()
    } else if (!previousGraphs.local || sinkChanged) {
      if (previousTargets.includes('local')) host.detachMicrophone('local')
      await host.closeLocal()
      await host.createLocal(plan)
      await host.setLocalSink(plan)
      await host.resumeLocal()
      rebuiltLocal = true
    }
    const needLocalMic = nextTargets.includes('local')
    const hadLocalMic = previousTargets.includes('local')
    const captureLivedOnLocal = rebuiltLocal && !previousGraphs.voice && previousTargets.length > 0
    if (captureLivedOnLocal) {
      await host.closeMicrophone()
      if (nextTargets.length > 0) {
        await host.openMicrophone(plan)
        for (const target of nextTargets) host.attachMicrophone(target)
      }
    } else if (needLocalMic && (!hadLocalMic || rebuiltLocal)) {
      if (previousTargets.length === 0) {
        await host.openMicrophone(plan)
        if (nextTargets.includes('voice')) host.attachMicrophone('voice')
      }
      host.attachMicrophone('local')
    } else if (!needLocalMic && hadLocalMic) {
      host.detachMicrophone('local')
    }
    return { ok: true, restored: false, message: null, microphoneTargets: nextTargets }
  } catch (error) {
    try {
      host.detachMicrophone('local')
      await host.closeLocal()
      if (graphsToCreate(previous).local) {
        await host.createLocal(previous)
        await host.setLocalSink(previous)
        await host.resumeLocal()
        if (microphoneTargets(previous).includes('local')) host.attachMicrophone('local')
      }
      return {
        ok: false,
        restored: true,
        message: failureMessage(error),
        microphoneTargets: microphoneTargets(previous),
      }
    } catch {
      return { ok: false, restored: false, message: failureMessage(error), microphoneTargets: [] }
    }
  }
}

/**
 * Close the old route, build the destination, then open one microphone.
 * A failed explicit device restores the previous plan and never substitutes a default device.
 * A headphone-only change leaves the voice-chat graph and its microphone capture in place.
 */
export async function applyAudioRoute(
  host: AudioRouteHost,
  plan: AudioRoutePlan,
  previous: AudioRoutePlan | null,
): Promise<RouteApplyResult> {
  if (
    previous
    && voiceRouteKey(previous) === voiceRouteKey(plan)
    && localRouteKey(previous) !== localRouteKey(plan)
  ) {
    return applyLocalRouteUpdate(host, plan, previous)
  }
  const targets = microphoneTargets(plan)
  const graphs = graphsToCreate(plan)
  try {
    await host.closeMicrophone()
    await host.closeVoice()
    await host.closeLocal()

    if (graphs.voice) {
      await host.createVoice(plan)
      await host.setVoiceSink(plan)
      await host.resumeVoice()
    }
    if (graphs.local) {
      await host.createLocal(plan)
      await host.setLocalSink(plan)
      await host.resumeLocal()
    }
    if (targets.length > 0) {
      await host.openMicrophone(plan)
      for (const target of targets) {
        host.attachMicrophone(target)
      }
    }
    return { ok: true, restored: false, message: null, microphoneTargets: targets }
  } catch (error) {
    await host.closeMicrophone().catch(() => undefined)
    await host.closeVoice().catch(() => undefined)
    await host.closeLocal().catch(() => undefined)
    if (!previous) {
      return { ok: false, restored: false, message: failureMessage(error), microphoneTargets: [] }
    }
    const restored = await applyAudioRoute(host, previous, null)
    return {
      ok: false,
      restored: restored.ok,
      message: failureMessage(error),
      microphoneTargets: restored.microphoneTargets,
    }
  }
}
