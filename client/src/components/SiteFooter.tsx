import { Link } from 'react-router-dom';

export const DEVELOPER = 'Deserius Arte';
export const COMPANY = 'Hustler Anomalies Enterprises LLC';
export const COPYRIGHT_YEAR = 2026;

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-white/5 px-5 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-center text-xs text-slate-500">
        <nav className="flex flex-wrap items-center justify-center gap-4 text-slate-400">
          <Link className="hover:text-white" to="/about">
            About & developer
          </Link>
          <Link className="hover:text-white" to="/privacy">
            Privacy
          </Link>
          <Link className="hover:text-white" to="/terms">
            Terms
          </Link>
        </nav>
        <p>
          © {COPYRIGHT_YEAR} {DEVELOPER}. All rights reserved in the original CipherRoom product,
          branding, and associated materials.
        </p>
        <p>
          A product of <span className="text-slate-300">{COMPANY}</span>.
        </p>
        <p className="max-w-3xl text-[11px] leading-5 text-slate-600">
          Disclaimer: CipherRoom is provided as-is. {DEVELOPER} and {COMPANY} are not responsible
          for how this application is used, for communications that take place in rooms, or for
          any loss, damage, or legal claim arising from use or misuse. Use at your own risk.
        </p>
      </div>
    </footer>
  );
}
