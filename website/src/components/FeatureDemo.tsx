import { useEffect, useRef, useState } from 'react'
import { MotionToggle } from './MotionToggle'

type DemoKind = 'replay' | 'trim' | 'soundboard'
const DETAILS = {
  replay: { title: 'Keep the moment', label: 'Illustration: a rolling audio buffer is captured as a clip with a hotkey.', hint: 'Your hotkey → a clip in your library', action: 'Clip saved to library' },
  trim: { title: 'Find the good part', label: 'Illustration: selection handles isolate a section of an audio waveform before saving.', hint: 'Drag the edges → preview → save', action: 'Your selection, ready to save' },
  soundboard: { title: 'Make it a regular', label: 'Illustration: a clip is assigned to one of seven soundboard pads and played with a hotkey.', hint: 'Click an assigned pad or use its hotkey', action: 'Assigned clip · Ready to play' },
}
const BARS = Array.from({ length: 48 }, (_, i) => {
  const envelope = 0.22 + 0.78 * Math.abs(Math.sin(i * 0.24))
  return 8 + (25 + ((i * 23 + i * i * 7) % 66)) * envelope
})

function DemoCursor() {
  return <span className="demo-cursor" aria-hidden="true">
    <svg viewBox="0 0 24 27" width="22" height="25" focusable="false">
      <path d="M2 2v19l5-5 4 8 4-2-4-8h8L2 2Z" fill="white" stroke="#13162c" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  </span>
}

export function FeatureDemo({ kind, className = '' }: { kind: DemoKind; className?: string }) {
  const details = DETAILS[kind]
  const figure = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .15 })
    if (figure.current) observer.observe(figure.current)
    return () => observer.disconnect()
  }, [])
  return <figure ref={figure} className={`feature-demo demo-${kind} ${className}`} data-playing={visible && !paused}>
    <div className="demo-top"><span><i aria-hidden /> {details.title}</span>
      <MotionToggle name="animation" paused={paused} onToggle={() => setPaused(value => !value)} />
    </div>
    <div className="demo-stage" role="img" aria-label={details.label}>
      <div className="demo-window" aria-hidden="true">
        <div className="demo-window-title"><span>SLIPUPCLIPZ</span><span>{kind === 'soundboard' ? 'Soundboard' : 'Clips'}</span></div>
        {kind === 'soundboard' ? <>
          <div className="demo-clip">≋ &nbsp; The perfect moment</div>
          <div className="demo-pads">{Array.from({ length: 7 }, (_, i) => <div className={`demo-pad pad-${i}`} key={i}>
            {i === 0 ? <><span className="demo-pad-play">▶</span><span className="demo-pad-stop">■</span><DemoCursor /></> : <span>+</span>}<small>{i === 0 ? 'My clip' : `Pad ${i + 1}`}</small>
          </div>)}</div>
        </> : <>
          <div className="demo-track-label"><span>{kind === 'trim' ? 'Trim your clip' : 'Replay buffer'}</span><span>Audio waveform</span></div>
          <div className="demo-waveform-wrap">
            <div className="demo-waveform">{BARS.map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}
              {kind === 'trim' && <><div className="demo-selection"><b /><b /></div><div className="demo-playhead" /></>}
            </div>
            {kind === 'trim' && <DemoCursor />}
          </div>
          <div className="demo-track-label"><span>0:00</span><span>0:08</span></div>
          <div className="demo-control">
            {kind === 'replay' ? <>⌨ &nbsp; Clip hotkey<DemoCursor /></> : '▷  Play'}
          </div>
        </>}
        {kind === 'replay' ? (
          <div className="demo-library"><span>Clip library</span><div className="demo-result">▶ &nbsp; The perfect moment <small>Saved</small></div></div>
        ) : <div className="demo-result">✓ &nbsp; {details.action}</div>}
      </div>
      <span className="demo-spark spark-one" aria-hidden>✦</span><span className="demo-spark spark-two" aria-hidden>＋</span>
    </div>
    <figcaption><span>Workflow illustration</span><p>{details.hint}</p></figcaption>
  </figure>
}
