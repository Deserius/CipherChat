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
  Hash,
  DoorOpen,
  Info,
  ScanLine,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { NameHint } from '../components/NameHint';
import { PermissionGate, type GateResult } from '../components/PermissionGate';
import { SiteFooter, DEVELOPER, COMPANY, COPYRIGHT_YEAR } from '../components/SiteFooter';
import { AdSlot } from '../components/AdSlot';
import { RulesModal } from '../components/RulesModal';
import { QrScan } from '../components/QrScan';
import { AvatarPicker } from '../components/AvatarMark';
import { getController } from '../services/roomController';
import { requestAv } from '../services/permissions';
import { useSession } from '../stores/session';
import { LOBBIES, lobbyBySlug } from '@shared/lobbies';

type HubTab = 'join' | 'lounges' | 'how';

export default function Landing() {
  const { code: pathCode, slug: pathSlug } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const prefill = pathCode || params.get('room') || '';
  const lobbySlug = (pathSlug || params.get('lobby') || '').toLowerCase();
  const lobby = lobbySlug ? lobbyBySlug(lobbySlug) : undefined;
  const isInvite = Boolean(prefill) && !lobby;
  const [rulesFor, setRulesFor] = useState<string | null>(null);
  const [live, setLive] = useState<{ slug: string; occupants: number; maxUsers: number }[]>([]);
  const [name, setName] = useState('');
  const [room, setRoom] = useState(prefill);
  const [shakeName, setShakeName] = useState(false);
  const [shakeRoom, setShakeRoom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<HubTab>('join');
  const [scanOpen, setScanOpen] = useState(false);
  const [avatar, setAvatar] = useState<string | undefined>(() => {
    try {
      return sessionStorage.getItem('cipherchat.avatar') || undefined;
    } catch {
      return undefined;
    }
  });
  const [gate, setGate] = useState<{ createRandom: boolean; lobby?: string; error?: string } | null>(null);
  const phase = useSession((s) => s.phase);
  const errorMessage = useSession((s) => s.errorMessage);

  useEffect(() => {
    if (prefill && !lobby) setRoom(prefill.replace(/\D/g, '').slice(0, 10));
  }, [prefill, lobby]);

  useEffect(() => {
    void fetch('/api/lobbies')
      .then((r) => r.json())
      .then((d) => setLive(Array.isArray(d.lobbies) ? d.lobbies : []))
      .catch(() => undefined);
  }, []);

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

  async function begin(createRandom: boolean, lobbyJoin?: string) {
    if (!requireName()) return;
    const lounge = lobbyJoin || lobby?.slug;
    if (lounge && !sessionStorage.getItem('cipherchat.rules.ok')) {
      setRulesFor(lounge);
      return;
    }
    if (!createRandom && !lounge && !roomValid) {
      setShakeRoom(true);
      window.setTimeout(() => setShakeRoom(false), 400);
      return;
    }
    setGate({ createRandom, lobby: lounge });
    const grant = await requestAv({ audio: true, video: false });
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
    setGate({ createRandom, lobby: lounge, error: grant.error ?? 'Permission was not granted.' });
  }

  async function afterGate(result: GateResult, createRandom = gate?.createRandom ?? false) {
    const lounge = gate?.lobby || lobby?.slug;
    setGate(null);
    setBusy(true);
    const ctrl = getController();
    if (result.stream) ctrl.pendingStream = result.stream;
    ctrl.notifyOnJoin = result.notify;
    try {
      try {
        if (avatar) sessionStorage.setItem('cipherchat.avatar', avatar);
      } catch {
        /* private mode */
      }
      await ctrl.enter({
        name: name.trim(),
        roomCode: createRandom || lounge ? undefined : room.trim(),
        createRandom,
        lobby: lounge,
        avatar,
      });
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void begin(false);
  }

  const focused = isInvite || Boolean(lobby);

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <div className="orb -left-24 top-24 h-72 w-72 bg-cyan-glow/20" />
      <div className="orb right-0 top-0 h-80 w-80 bg-violet-glow/20" style={{ animationDelay: '1.5s' }} />
      <div className="orb bottom-0 left-1/3 h-64 w-64 bg-mint/15" style={{ animationDelay: '3s' }} />

      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <Logo />
        <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm text-slate-400">
          <Link className="hover:text-white" to="/plus">
            Plus
          </Link>
          <Link className="hover:text-white" to="/help">
            Help
          </Link>
          <Link className="hover:text-white" to="/about">
            About
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-16 sm:px-5">
        <section className="animate-fadeIn mx-auto max-w-2xl pt-4 text-center sm:pt-8">
          <div className="badge mb-4">
            <span className="lock-dot" />
            {lobby
              ? `Lounge · ${lobby.name}`
              : isInvite
                ? 'You were invited · No account needed'
                : 'No account · Ephemeral · Privacy-first'}
          </div>
          <h1 className="text-[2rem] font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl">
            {lobby ? (
              <>
                Join {lobby.name}
                <br />
                <span className="bg-gradient-to-r from-cyan-glow via-white to-violet-glow bg-clip-text text-transparent">
                  {lobby.theme}
                </span>
              </>
            ) : isInvite ? (
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
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-400 sm:text-lg">
            {lobby
              ? `${lobby.blurb} Max ${lobby.maxUsers} people — overflow opens ${lobby.name} 2. House rules apply.`
                : isInvite
                ? 'Enter a display name and allow the microphone. Camera stays off until you turn it on.'
                : 'Pick a name. Join a code, create a room, or drop into a lounge. Camera stays off until you turn it on.'}
          </p>
        </section>

        <section className="animate-fadeIn mx-auto mt-8 max-w-3xl">
          <form
            onSubmit={onSubmit}
            className="glass relative overflow-hidden rounded-3xl p-5 sm:p-7"
            aria-label={isInvite ? 'Join invited room' : 'Enter CipherChat'}
          >
            <div className="scanline" />

            <label className="mb-1 block text-left text-xs font-medium uppercase tracking-wider text-slate-400">
              Your name
            </label>
            <div className="relative mb-4">
              {!name && <NameHint />}
              <input
                className={`field ${shakeName ? 'shake' : ''}`}
                placeholder=""
                maxLength={32}
                autoComplete="nickname"
                autoFocus={focused}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-required="true"
                aria-label="Your name"
              />
            </div>
            <div className="mb-5">
              <AvatarPicker
                value={avatar}
                onChange={(v) => {
                  setAvatar(v);
                  try {
                    if (v) sessionStorage.setItem('cipherchat.avatar', v);
                    else sessionStorage.removeItem('cipherchat.avatar');
                  } catch {
                    /* private mode */
                  }
                }}
              />
            </div>

            {!focused && (
              <div className="mb-5 flex gap-1 rounded-2xl border border-white/10 bg-black/25 p-1" role="tablist">
                <HubTabBtn id="join" active={tab === 'join'} onClick={() => setTab('join')} icon={<Hash className="h-4 w-4" />} label="Join" />
                <HubTabBtn id="lounges" active={tab === 'lounges'} onClick={() => setTab('lounges')} icon={<DoorOpen className="h-4 w-4" />} label="Lounges" />
                <HubTabBtn id="how" active={tab === 'how'} onClick={() => setTab('how')} icon={<Info className="h-4 w-4" />} label="How it works" />
              </div>
            )}

            {errorMessage && phase !== 'room' && (
              <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-left text-sm text-rose-200" role="alert">
                {errorMessage}
              </div>
            )}

            {lobby ? (
              <>
                <p className="mb-5 text-left text-sm text-cyan-100">
                  {lobby.name} · max {lobby.maxUsers} on camera
                </p>
                <button className="btn btn-primary w-full" type="submit" disabled={busy}>
                  {busy ? 'Connecting…' : `Enter ${lobby.name}`}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            ) : isInvite ? (
              <>
                <p className="mb-5 text-left font-mono text-sm tracking-[0.2em] text-cyan-100">Room {room}</p>
                <button className="btn btn-primary w-full" type="submit" disabled={busy}>
                  {busy ? 'Connecting…' : 'Continue'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            ) : tab === 'join' ? (
              <div role="tabpanel">
                <label className="mb-1 block text-left text-xs font-medium uppercase tracking-wider text-slate-400">
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
                <p id="room-hint" className="mb-3 text-left text-xs text-slate-500">
                  4–10 digits. Same number = same room. Or scan a friend’s QR.
                </p>
                <button
                  className="btn btn-ghost mb-3 w-full"
                  type="button"
                  onClick={() => setScanOpen(true)}
                >
                  <ScanLine className="h-4 w-4" />
                  Scan QR code
                </button>
                <button className="btn btn-primary w-full" type="submit" disabled={busy}>
                  {busy ? 'Connecting…' : 'Join secure room'}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  className="btn btn-ghost mt-3 w-full"
                  type="button"
                  disabled={busy}
                  onClick={() => void begin(true)}
                >
                  <Sparkles className="h-4 w-4" />
                  Create random room
                </button>
              </div>
            ) : tab === 'lounges' ? (
              <div role="tabpanel">
                <p className="mb-4 text-left text-sm text-slate-400">
                  No code. Caps apply — a full lounge opens the same name with a 2. No nudity, no hate.
                </p>
                <div className="grid max-h-[min(52dvh,420px)] gap-2 overflow-y-auto sm:grid-cols-2">
                  {LOBBIES.map((l) => {
                    const info = live.find((x) => x.slug === l.slug);
                    return (
                      <button
                        key={l.slug}
                        type="button"
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left hover:border-cyan-glow/40"
                        onClick={() => void begin(false, l.slug)}
                      >
                        <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-glow">{l.theme}</div>
                        <div className="mt-0.5 font-semibold text-white">{l.name}</div>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-400">{l.blurb}</p>
                        <div className="mt-2 text-[11px] text-slate-500">
                          Max {l.maxUsers} · {info ? `${info.occupants} in` : 'open'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div role="tabpanel" className="space-y-4 text-left">
                <ol className="grid gap-3 sm:grid-cols-3">
                  <Step n="01" title="Name" body="A display name for this session only." />
                  <Step n="02" title="Enter" body="Code, random room, or a lounge. Mic optional. Camera stays off." />
                  <Step n="03" title="Vanish" body="Last person out destroys keys, chat, and files." />
                </ol>
                <ul className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  <li className="flex gap-2">
                    <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-cyan-glow" /> No email, password, or profile
                  </li>
                  <li className="flex gap-2">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-mint" /> Encrypted chat + WebRTC media
                  </li>
                  <li className="flex gap-2">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-violet-glow" /> Voice, video, screen, secrets
                  </li>
                  <li className="flex gap-2">
                    <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-cyan-glow" /> No trackers by default
                  </li>
                </ul>
                <div className="flex flex-wrap gap-3 pt-1 text-sm">
                  <Link className="text-cyan-glow hover:underline" to="/plus">
                    Plus & Party →
                  </Link>
                  <Link className="text-cyan-glow hover:underline" to="/help">
                    Help →
                  </Link>
                  <Link className="text-cyan-glow hover:underline" to="/privacy">
                    Privacy →
                  </Link>
                </div>
              </div>
            )}

            {tab !== 'how' && (
              <p className="mt-4 text-center text-xs text-slate-500">
                Next: allow microphone. Camera stays off until you tap Camera in the room. No account.
              </p>
            )}
          </form>
        </section>

        {!focused && (
          <section className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
            <Mini icon={<Zap className="h-4 w-4" />} title="Ephemeral" body="Rooms die when empty. Chat is not stored." />
            <Mini icon={<Radio className="h-4 w-4" />} title="Live" body="Mesh WebRTC. P2P first, TURN if needed." />
            <Mini icon={<Lock className="h-4 w-4" />} title="Yours" body="Pass codes for Plus. No CipherChat login." />
          </section>
        )}

        <section className="mx-auto mt-10 max-w-3xl" aria-labelledby="about-dev">
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="glass rounded-2xl p-5 sm:col-span-2">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-glow">Creator</div>
              <h2 id="about-dev" className="mt-1 text-lg font-semibold text-white">
                {DEVELOPER}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Published by {COMPANY}. © {COPYRIGHT_YEAR} {DEVELOPER}.{' '}
                <Link className="text-cyan-glow hover:underline" to="/about">
                  Full disclaimer →
                </Link>
              </p>
            </article>
            <article className="glass rounded-2xl border border-amber-400/20 p-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-200/80">Disclaimer</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {DEVELOPER} and {COMPANY} are not legally responsible for how this app is used.
              </p>
            </article>
          </div>
        </section>

        {!isInvite && <AdSlot placement="landing" />}
      </main>

      <SiteFooter />

      {scanOpen && (
        <QrScan
          onClose={() => setScanOpen(false)}
          onResult={(hit) => {
            setScanOpen(false);
            if (hit.lobby) {
              void begin(false, hit.lobby);
              return;
            }
            if (hit.room) {
              setRoom(hit.room);
              setTab('join');
            }
          }}
        />
      )}

      {rulesFor && (
        <RulesModal
          lounge={lobbyBySlug(rulesFor)?.name ?? 'Lounge'}
          onDisagree={() => setRulesFor(null)}
          onAgree={() => {
            sessionStorage.setItem('cipherchat.rules.ok', '1');
            const slug = rulesFor;
            setRulesFor(null);
            void begin(false, slug);
          }}
        />
      )}

      {gate && (
        <PermissionGate
          title={gate.createRandom ? 'Allow microphone' : `Allow microphone to join ${lobby?.name || room || 'the room'}`}
          confirmLabel={gate.createRandom ? 'Create room' : 'Join room'}
          error={gate.error}
          onCancel={() => setGate(null)}
          onConfirm={(r) => void afterGate(r)}
        />
      )}
    </div>
  );
}

function HubTabBtn({
  id,
  active,
  onClick,
  icon,
  label,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      id={`hub-${id}`}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium sm:text-sm ${
        active ? 'bg-cyan-glow/15 text-white' : 'text-slate-400 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="font-mono text-[11px] text-cyan-glow">{n}</div>
      <h3 className="mt-1 font-semibold text-white">{title}</h3>
      <p className="mt-1 text-xs text-slate-400">{body}</p>
    </li>
  );
}

function Mini({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <article className="glass rounded-2xl p-4">
      <div className="mb-2 text-cyan-glow">{icon}</div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 text-xs text-slate-400">{body}</p>
    </article>
  );
}
