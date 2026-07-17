import { Link } from 'react-router-dom'
import { Button } from '../components/Button'
import { SectionHeading } from '../components/SectionHeading'
import { Seo } from '../components/Seo'
import { SITE } from '../config/site'

export function DownloadPage() {
  return (
    <>
      <Seo
        title="Download"
        description="Download SlipUpClipz for Windows 10/11. Installer size, requirements, VB-Cable notes, and SmartScreen guidance."
        path={SITE.paths.download}
      />
      <section className="site-container py-14 sm:py-20">
        <SectionHeading
          eyebrow="Download"
          title="Get SlipUpClipz for Windows"
          description="Grab the latest installer and start clipping in minutes."
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="panel p-6 sm:p-8">
            <p className="text-sm text-slate-400">Latest version</p>
            <p className="mt-1 font-display text-3xl font-bold text-white">
              v{SITE.currentVersion}
            </p>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">File size</dt>
                <dd className="mt-1 text-slate-200">{SITE.installerSizeLabel}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Platform</dt>
                <dd className="mt-1 text-slate-200">Windows 10 / 11 (x64)</dd>
              </div>
              <div>
                <dt className="text-slate-500">Installer</dt>
                <dd className="mt-1 text-slate-200">NSIS Setup (.exe)</dd>
              </div>
              <div>
                <dt className="text-slate-500">Release notes</dt>
                <dd className="mt-1">
                  <Link to={SITE.paths.changelog} className="text-glow-magenta hover:underline">
                    Changelog
                  </Link>
                  <span className="text-slate-600"> · </span>
                  <a
                    href={SITE.releasesUrl}
                    className="text-glow-magenta hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub
                  </a>
                </dd>
              </div>
            </dl>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button href={SITE.downloadUrl} className="btn-lift">
                Download for Windows
              </Button>
              <Button to={SITE.paths.pricing} variant="secondary" className="btn-lift">
                Compare Free vs Pro
              </Button>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="panel p-5">
              <h2 className="font-display text-lg font-semibold text-white">
                Minimum requirements
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li>Windows 10 or Windows 11 (64-bit)</li>
                <li>Microphone (for voice capture / effects)</li>
                <li>Headphones recommended for monitoring</li>
                <li>Optional: VB-Audio Virtual Cable for Discord routing</li>
              </ul>
            </div>
            <div className="panel p-5">
              <h2 className="font-display text-lg font-semibold text-white">
                Installation steps
              </h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-400">
                <li>Download the Setup .exe from the button above.</li>
                <li>Run the installer and follow the prompts.</li>
                <li>Launch SlipUpClipz and complete the guided tour.</li>
                <li>Pick your mic, replay source, and Clip hotkey.</li>
              </ol>
            </div>
          </aside>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="panel p-5">
            <h2 className="font-display text-lg font-semibold text-white">
              VB-Audio Virtual Cable
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Needed when you want Discord or games to hear your microphone and soundboard as one
              input. Install from the official VB-Audio site, then select the cable in SlipUpClipz
              and in Discord.
            </p>
            <a
              href={SITE.vbAudioUrl}
              className="mt-4 inline-flex text-sm font-semibold text-glow-cyan hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              VB-Audio Virtual Cable →
            </a>
          </div>
          <div className="panel p-5">
            <h2 className="font-display text-lg font-semibold text-white">
              Windows SmartScreen
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              If the app is not fully code-signed yet, Windows may show a SmartScreen warning. When
              you downloaded from this site or the official GitHub release, choose More info → Run
              anyway. A signing certificate will reduce these prompts later.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
