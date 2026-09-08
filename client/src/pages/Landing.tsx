import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Lock,
  Radio,
  ShieldOff,
  Users,
  Zap,
  EyeOff,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { PermissionGate, type GateResult } from '../components/PermissionGate';
import { SiteFooter, DEVELOPER, COMPANY, COPYRIGHT_YEAR } from '../components/SiteFooter';
import { getController } from '../services/roomController';
import { requestAv } from '../services/permissions';
import { useSession } from '../stores/session';

export default function Landing() {
  const { code: pathCode } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const prefill = pathCode || params.get('room') || '';
  const isInvite = Boolean(prefill);
  const [name, setName] = useState('');
  const [room, setRoom] = useState(prefill);
  const [shakeName, setShakeName] = useState(false);
  const [shakeRoom, setShakeRoom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState<{ createRandom: boolean; error?: string } | null>(null);
  const phase = useSession((s) => s.phase);
  const errorMessage = useSession((s) => s.errorMessage);

  useEffect(() => {
    if (prefill) setRoom(prefill.replace(/\D/g, '').slice(0, 10));
  }, [prefill]);

  useEffect(() => {
    if (phase === 'room') {
      const code = useSession.getState().roomCode;
      nav(`/room/${code}`, { replace: true });
    }
  }, [phase, nav]);

  const roomValid = useMemo(() => /^\d{4,10}$/.test(room.trim()), [room]);

  function requireName() {
    if (name.trim().length < 1) {
      setShakeName(true);
      window.setTimeout(() => setShakeName(false), 400);
      return false;
    }
    return true;
  }

  async function begin(createRandom: boolean) {
    if (!requireName()) return;
    if (!createRandom && !roomValid) {
      setShakeRoom(true);
      window.setTimeout(() => setShakeRoom(false), 400);
      return;
    }
    setGate({ createRandom });
    const grant = await requestAv({ audio: true, video: true });
    if (grant.stream) {
      await afterGate(
        {
          stream: grant.stream,
          audio: grant.audio,
          video: grant.video,
          notify: false,
          chatOnly: false,
        },
        createRandom,
      );
      return;
    }
    setGate({ createRandom, error: grant.error ?? 'Permission was not granted.' });
  }

  async function afterGate(result: GateResult, createRandom = gate?.createRandom ?? false) {
    setGate(null);
    setBusy(true);
    const ctrl = getController();
    if (result.stream) ctrl.pendingStream = result.stream;
    ctrl.notifyOnJoin = result.notify;
    try {
      await ctrl.enter({
        name: name.trim(),
        roomCode: createRandom ? undefined : room.trim(),
        createRandom,
      });
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void begin(false);
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="orb -left-24 top-24 h-72 w-72 bg-cyan-glow/20" />
      <div className="orb right-0 top-0 h-80 w-80 bg-violet-glow/20" style={{ animationDelay: '1.5s' }} />
      <div className="orb bottom-0 left-1/3 h-64 w-64 bg-mint/15" style={{ animationDelay: '3s' }} />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-4 text-sm text-slate-400">
          <Link className="hover:text-white" to="/about">
            About
          </Link>
          <Link className="hover:text-white" to="/privacy">
            Privacy
          </Link>
          <Link className="hover:text-white" to="/terms">
            Terms
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-6 lg:grid-cols-2 lg:pt-10">
        <section className="animate-fadeIn">
          <div className="badge mb-5">
            <span className="lock-dot" />
            {isInvite ? 'You were invited · No account needed' : 'No account · Ephemeral · Privacy-first'}
          </div>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {isInvite ? (
              <>
                Join secure room
                <br />
                <span className="bg-gradient-to-r from-cyan-glow via-white to-violet-glow bg-clip-text font-mono text-transparent tracking-[0.12em]">
                  {room}
                </span>
              </>
            ) : (
              <>
                Private communication.
                <br />
                <span className="bg-gradient-to-r from-cyan-glow via-white to-violet-glow bg-clip-text text-transparent">
                  No permanent identity.
                </span>
              </>
            )}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-400">
            {isInvite
              ? 'Enter a display name, allow camera and microphone, and you are in. No signup.'
              : 'Create a temporary encrypted room and communicate without creating an account. Messages live in memory. Rooms disappear when everyone leaves.'}
          </p>
          {!isInvite && (
            <ul className="mt-8 space-y-3 text-sm text-slate-300">
              <li className="flex items-center gap-3">
                <ShieldOff className="h-4 w-4 text-cyan-glow" /> No email, password, or profile
              </li>
              <li className="flex items-center gap-3">
                <Lock className="h-4 w-4 text-mint" /> Client-side encrypted messaging + WebRTC media
              </li>
              <li className="flex items-center gap-3">
                <Users className="h-4 w-4 text-violet-glow" /> Group chat, voice, video, and screen share
              </li>
            </ul>
          )}
        </section>

        <section className="animate-fadeIn">
          <form
            onSubmit={onSubmit}
            className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8"
            aria-label={isInvite ? 'Join invited room' : 'Enter a secure room'}
          >
            <div className="scanline" />
            <div className="mb-6">
              <div className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-glow/80">
                {isInvite ? 'One-tap join' : 'Secure terminal'}
              </div>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                {isInvite ? 'What should we call you?' : 'Enter a room'}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {isInvite
                  ? 'Then allow camera and mic. That is the entire identity.'
                  : 'Display name + room code. You will be asked for camera and mic next.'}
              </p>
            </div>

            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">
              Your name
            </label>
            <input
              className={`field mb-4 ${shakeName ? 'shake' : ''}`}
              placeholder="Deserius"
              maxLength={32}
              autoComplete="nickname"
              autoFocus={isInvite}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-required="true"
            />

            {isInvite ? (
              <p className="mb-5 font-mono text-sm tracking-[0.2em] text-cyan-100">
                Room {room}
              </p>
            ) : (
              <>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">
                  Room code
                </label>
                <input
                  className={`field mb-2 font-mono tracking-[0.3em] ${shakeRoom ? 'shake' : ''}`}
                  placeholder="482917"
                  inputMode="numeric"
                  pattern="\d{4,10}"
                  maxLength={10}
                  value={room}
                  onChange={(e) => setRoom(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  aria-describedby="room-hint"
                />
                <p id="room-hint" className="mb-5 text-xs text-slate-500">
                  4–10 digits. Share the same number to meet. Random rooms default to 6 digits.
                </p>
              </>
            )}

            {errorMessage && phase !== 'room' && (
              <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
                {errorMessage}
              </div>
            )}

            <button className="btn btn-primary w-full" type="submit" disabled={busy}>
              {busy ? 'Connecting…' : isInvite ? 'Continue' : 'Join secure room'}
              <ArrowRight className="h-4 w-4" />
            </button>
            {!isInvite && (
              <button
                className="btn btn-ghost mt-3 w-full"
                type="button"
                disabled={busy}
                onClick={() => void begin(true)}
              >
                <Sparkles className="h-4 w-4" />
                Create random room
              </button>
            )}
            <p className="mt-4 text-center text-xs text-slate-500">
              Next: allow camera & microphone, then you enter. No account.
            </p>
          </form>
        </section>
      </main>

      {!isInvite && (
        <>
          <section className="relative z-10 mx-auto max-w-6xl px-5 pb-16">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Feature icon={<EyeOff className="h-5 w-5" />} title="Private by design" body="No permanent social profile. Display names last only for the session." />
              <Feature icon={<Zap className="h-5 w-5" />} title="Ephemeral rooms" body="Rooms disappear after the session ends. Chat is not written to a database." />
              <Feature icon={<Radio className="h-5 w-5" />} title="Real-time" body="Instant messaging and WebRTC audio, video, and screen sharing." />
              <Feature icon={<Users className="h-5 w-5" />} title="Group ready" body="Invite multiple people into one room. Mesh WebRTC for small groups." />
              <Feature icon={<Lock className="h-5 w-5" />} title="Open architecture" body="Designed for transparency and community auditing. No trackers by default." />
            </div>
          </section>
          <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20">
            <h2 className="mb-6 text-xl font-semibold text-white">How a room lives and dies</h2>
            <ol className="grid gap-4 md:grid-cols-3">
              <Step n="01" title="Enter" body="Pick a display name and a 4–10 digit room code — or generate a random one." />
              <Step n="02" title="Allow devices" body="Grant camera and mic. Share a QR or link so others join in one tap." />
              <Step n="03" title="Vanish" body="When the last person leaves, CipherRoom destroys room state, keys, and files." />
            </ol>
            <p className="mt-6 max-w-3xl text-sm text-slate-500">
              Designed for minimal data retention. Hosting providers and networks may still generate technical logs outside this application. Read the{' '}
              <Link className="text-cyan-glow hover:underline" to="/privacy">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </>
      )}

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-10" aria-labelledby="about-dev">
        <h2 id="about-dev" className="mb-6 text-xl font-semibold text-white">
          About the developer
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <article className="glass rounded-2xl p-6 lg:col-span-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-glow">Creator</div>
            <h3 className="mt-2 text-2xl font-semibold text-white">{DEVELOPER}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              CipherRoom is an original work by {DEVELOPER}. The product is published by{' '}
              <span className="text-slate-200">{COMPANY}</span>. © {COPYRIGHT_YEAR} {DEVELOPER}.
            </p>
            <Link className="mt-4 inline-flex text-sm text-cyan-glow hover:underline" to="/about">
              Full copyright, company, and disclaimer →
            </Link>
          </article>
          <article className="glass rounded-2xl border border-amber-400/20 p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-200/80">Disclaimer</div>
            <h3 className="mt-2 text-lg font-semibold text-white">Use at your own risk</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {DEVELOPER} and {COMPANY} are not legally responsible for how this app is used.
            </p>
          </article>
        </div>
      </section>

      <SiteFooter />

      {gate && (
        <PermissionGate
          title={gate.createRandom ? 'Allow camera & microphone' : `Allow camera & microphone to join ${room || 'the room'}`}
          confirmLabel={gate.createRandom ? 'Create room' : 'Join room'}
          error={gate.error}
          onCancel={() => setGate(null)}
          onConfirm={(r) => void afterGate(r)}
        />
      )}
    </div>
  );
}

function Feature({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <article className="glass rounded-2xl p-5">
      <div className="mb-3 text-cyan-glow">{icon}</div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{body}</p>
    </article>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="glass rounded-2xl p-5">
      <div className="font-mono text-xs text-cyan-glow">{n}</div>
      <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{body}</p>
    </li>
  );
}
