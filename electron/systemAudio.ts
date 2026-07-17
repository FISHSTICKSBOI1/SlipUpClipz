import { desktopCapturer, session } from 'electron'

let loopbackCaptureEnabled = false

export function setupSystemAudioCapture(): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      if (!loopbackCaptureEnabled || !request.audioRequested) {
        callback({})
        return
      }

      void desktopCapturer
        .getSources({ types: ['screen'] })
        .then((sources) => {
          const screen = sources[0]
          if (!screen) {
            callback({})
            return
          }

          callback({ video: screen, audio: 'loopback' })
        })
        .catch(() => {
          callback({})
        })
    },
    { useSystemPicker: false },
  )
}

export function enableLoopbackCapture(): void {
  loopbackCaptureEnabled = true
}

export function disableLoopbackCapture(): void {
  loopbackCaptureEnabled = false
}

export function isLoopbackCaptureSupported(): boolean {
  return process.platform === 'win32' || process.platform === 'linux'
}
