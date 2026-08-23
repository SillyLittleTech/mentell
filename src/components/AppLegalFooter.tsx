import { Link } from 'react-router-dom'
import { useState } from 'react'
import { format } from 'date-fns'
import { appVersion, commitSha, buildTime, refreshTime } from '../shared/version'

const SILLY_LITTLE_TECH_URL = 'https://sillylittle.tech'
const BSD_LICENSE_URL = 'https://opensource.org/license/bsd-2-clause'

export function AppLegalFooter() {
  const [hover, setHover] = useState(false)

  return (
    <footer className="mx-auto mt-10 w-full max-w-4xl pb-8 text-center">
      <div
        className="relative flex items-center justify-center cursor-help mx-auto w-max"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <p className="font-mono text-[10px] tracking-wide text-[var(--paper-ink-muted)] opacity-70">
          v{appVersion}
        </p>

        {hover && (
          <div className="absolute bottom-full mb-2 z-50 flex flex-col gap-2 pointer-events-none w-max">
            <div className="paper flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-sm shadow-md animate-in fade-in slide-in-from-bottom-2">
              <div>{format(new Date(buildTime), 'PPp')} · {format(new Date(refreshTime), 'PPp')}</div>
              <div className="uppercase tracking-widest text-[10px] font-mono opacity-70">
                BUILD {commitSha}
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-sm leading-relaxed text-[var(--paper-ink-muted)]">
        A project by{' '}
        <a
          href={SILLY_LITTLE_TECH_URL}
          className="font-medium text-[var(--link-accent)] underline-offset-2 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          SillyLittleTech
        </a>
        <span className="mx-2 opacity-40" aria-hidden>
          ·
        </span>
        <Link
          to="/privacy"
          className="focus-ring underline-offset-2 hover:text-[var(--paper-ink)] hover:underline"
        >
          Privacy
        </Link>
      </p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--paper-ink-muted)] opacity-80">
        © {new Date().getFullYear()} Kiya Rose. Fiscally sponsored by The Hack Foundation (d.b.a.
        Hack Club), a 501(c)(3) nonprofit (EIN: 81-2908499). Licensed under{' '}
        <a
          href={BSD_LICENSE_URL}
          className="underline-offset-2 hover:text-[var(--paper-ink)] hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          BSD-2-Clause
        </a>
        .
      </p>
    </footer>
  )
}
