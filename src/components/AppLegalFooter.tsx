import { Link } from 'react-router-dom'
import { appVersion } from '../shared/version'

const SILLY_LITTLE_TECH_URL = 'https://sillylittle.tech'
const BSD_LICENSE_URL = 'https://opensource.org/license/bsd-2-clause'

export function AppLegalFooter() {
  return (
    <footer className="mx-auto mt-10 w-full max-w-4xl pb-8 text-center">
      <p className="font-mono text-[10px] tracking-wide text-[rgba(243,240,247,0.45)]">
        v{appVersion}
      </p>

      <p className="mt-4 text-sm leading-relaxed text-[rgba(243,240,247,0.72)]">
        A project by{' '}
        <a
          href={SILLY_LITTLE_TECH_URL}
          className="font-medium text-[#b794f6] underline-offset-2 hover:underline"
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
          className="focus-ring underline-offset-2 hover:text-[rgba(243,240,247,0.85)] hover:underline"
        >
          Privacy
        </Link>
      </p>
      <p className="mt-2 text-xs leading-relaxed text-[rgba(243,240,247,0.55)]">
        © {new Date().getFullYear()} Kiya Rose. Fiscally sponsored by The Hack Foundation (d.b.a.
        Hack Club), a 501(c)(3) nonprofit (EIN: 81-2908499). Licensed under{' '}
        <a
          href={BSD_LICENSE_URL}
          className="underline-offset-2 hover:text-[rgba(243,240,247,0.85)] hover:underline"
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
