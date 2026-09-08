import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { SiteFooter, DEVELOPER, COMPANY, COPYRIGHT_YEAR } from '../components/SiteFooter';

export default function AboutPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link to="/">
          <Logo compact />
        </Link>
        <Link className="text-sm text-slate-400 hover:text-white" to="/">
          Home
        </Link>
      </header>

      <article className="mx-auto max-w-3xl px-5 pb-16">
        <div className="badge mb-5">
          <span className="lock-dot" />
          About the developer
        </div>
        <h1 className="text-4xl font-semibold text-white">CipherRoom</h1>
        <p className="mt-3 text-lg text-slate-400">
          Private, ephemeral communication rooms. No permanent identity.
        </p>

        <section className="glass mt-10 rounded-3xl p-6 sm:p-8">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-glow">Developer</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">{DEVELOPER}</h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-300">
            CipherRoom was designed and built by {DEVELOPER}. The original product concept,
            interface, architecture, and branding are the creative work of the developer.
          </p>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-2xl bg-white/5 px-4 py-3">
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">Developer</dt>
              <dd className="mt-1 text-white">{DEVELOPER}</dd>
            </div>
            <div className="rounded-2xl bg-white/5 px-4 py-3">
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">Company</dt>
              <dd className="mt-1 text-white">{COMPANY}</dd>
            </div>
            <div className="rounded-2xl bg-white/5 px-4 py-3 sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">Copyright</dt>
              <dd className="mt-1 text-white">
                © {COPYRIGHT_YEAR} {DEVELOPER}. CipherRoom and related original materials are
                protected by copyright. Unauthorized copying of the product’s branding, distinctive
                design, or proprietary assets is not permitted. Open-source components used by this
                application remain under their own licenses.
              </dd>
            </div>
          </dl>
        </section>

        <section className="glass mt-6 rounded-3xl p-6 sm:p-8">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-200/80">Disclaimer</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">No legal responsibility for use</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-7 text-slate-300">
            <p>
              CipherRoom is a technical tool for temporary communication. {DEVELOPER} and {COMPANY}{' '}
              do <strong className="text-white">not</strong> monitor rooms, do not join your
              conversations, and do not accept responsibility for how any person uses this software.
            </p>
            <p>
              You are solely responsible for your conduct, the people you invite, the content you
              send, and compliance with the laws that apply to you. This includes, without
              limitation, privacy, recording-consent, harassment, intellectual property, export,
              and criminal law.
            </p>
            <p>
              To the maximum extent permitted by law, {DEVELOPER} and {COMPANY} disclaim all
              liability for:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-slate-400">
              <li>Any use or misuse of CipherRoom by you or by anyone you invite</li>
              <li>Communications, files, or media exchanged inside a room</li>
              <li>Lost messages, dropped calls, room destruction, or service interruption</li>
              <li>Unauthorized access that results from a shared room code or invite link</li>
              <li>Actions of third-party networks, STUN/TURN relays, hosts, or browsers</li>
              <li>Damages, claims, losses, or legal proceedings of any kind arising from the app</li>
            </ul>
            <p>
              The software is provided <em>“as is”</em> and <em>“as available,”</em> without
              warranties of merchantability, fitness for a particular purpose, non-infringement, or
              uninterrupted operation. If you do not agree, do not use CipherRoom.
            </p>
            <p className="text-sm text-slate-500">
              This page is informational and is not legal advice. See also the{' '}
              <Link className="text-cyan-glow hover:underline" to="/terms">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link className="text-cyan-glow hover:underline" to="/privacy">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </section>
      </article>

      <SiteFooter />
    </div>
  );
}
