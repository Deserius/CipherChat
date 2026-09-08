import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Copy,
  Check,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
  MessageSquare,
  Users,
  Link2,
  Paperclip,
  Send,
  Shield,
  Wifi,
  WifiOff,
  Maximize2,
  Settings2,
  X,
  Smile,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { useSession, type ChatLine } from '../stores/session';
import {
  EMOJIS,
  formatTime,
  getController,
  initials,
  inviteUrl,
  participantColor,
} from '../services/roomController';
import type { PeerMedia } from '../webrtc/callManager';
import { listDevices } from '../webrtc/callManager';
import { InviteShare } from '../components/InviteShare';

export default function RoomPage() {
  const { code } = useParams();
  const nav = useNavigate();
  const phase = useSession((s) => s.phase);
  const roomCode = useSession((s) => s.roomCode);
  const connection = useSession((s) => s.connection);
  const errorMessage = useSession((s) => s.errorMessage);

  useEffect(() => {
    if (phase === 'landing') nav(code ? `/r/${code}` : '/', { replace: true });
    if (phase === 'left') nav('/left', { replace: true });
    if (phase === 'destroyed') nav('/destroyed', { replace: true });
    if (phase === 'error') nav('/error', { replace: true });
  }, [phase, nav, code]);

  if (phase === 'connecting' || phase === 'reconnecting') {
    return (
      <Connecting
        title={phase === 'reconnecting' ? 'Reconnecting…' : 'Connecting to secure room…'}
        subtitle={phase === 'reconnecting' ? 'Connection interrupted. Trying again.' : 'Establishing session and encryption context.'}
      />
    );
  }

  if (phase !== 'room') {
    return (
      <Connecting
        title={errorMessage ?? 'Unable to connect.'}
        subtitle="Returning you to the entrance."
      />
    );
  }

  return <RoomShell expected={roomCode} />;
}

function Connecting({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5">
      <Logo />
      <div className="glass relative mt-8 w-full max-w-md overflow-hidden rounded-3xl p-8 text-center">
        <div className="scanline" />
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-cyan-glow/20 border-t-cyan-glow" />
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

function RoomShell({ expected }: { expected: string }) {
  const ctrl = getController();
  const [tab, setTab] = useState<'chat' | 'call' | 'people'>('chat');
  const [peers, setPeers] = useState<PeerMedia[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [mic, setMic] = useState(false);
  const [cam, setCam] = useState(false);
  const [screen, setScreen] = useState(false);
  const [devices, setDevices] = useState<Awaited<ReturnType<typeof listDevices>>>({
    cameras: [],
    mics: [],
    speakers: [],
  });
  const [quality, setQuality] = useState<Record<string, number>>({});
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [perm, setPerm] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const created = useSession((s) => s.created);

  const participants = useSession((s) => s.participants);
  const name = useSession((s) => s.name);
  const participantId = useSession((s) => s.participantId);
  const cryptoReady = useSession((s) => s.cryptoReady);
  const connection = useSession((s) => s.connection);
  const mediaError = useSession((s) => s.mediaError);
  const banner = useSession((s) => s.banner);

  useEffect(() => {
    ctrl.onPeerMedia = setPeers;
    ctrl.onLocalStream = (s) => {
      setLocalStream(s);
      setMic(ctrl.call.micOn);
      setCam(ctrl.call.cameraOn);
    };
    ctrl.onQuality = (id, score) => setQuality((q) => ({ ...q, [id]: score }));
    ctrl.refreshDevices().then(() => listDevices().then(setDevices));
    setMic(ctrl.call.micOn);
    setCam(ctrl.call.cameraOn);
    setScreen(ctrl.call.screenOn);
    if (ctrl.call.cameraOn) setTab('call');
  }, [ctrl]);

  useEffect(() => {
    if (created) setInviteOpen(true);
  }, [created]);

  useEffect(() => {
    if (mediaError) {
      setPerm(mediaError);
      const t = window.setTimeout(() => useSession.getState().set({ mediaError: undefined }), 80);
      return () => window.clearTimeout(t);
    }
  }, [mediaError]);

  async function toggleMic() {
    await ctrl.call.setMicrophone(!mic);
    setMic(ctrl.call.micOn);
    ctrl.publishMediaState();
    setDevices(await listDevices());
  }
  async function toggleCam() {
    await ctrl.call.setCamera(!cam);
    setCam(ctrl.call.cameraOn);
    ctrl.publishMediaState();
    setDevices(await listDevices());
    if (ctrl.call.cameraOn) setTab('call');
  }
  async function toggleScreen() {
    await ctrl.call.setScreen(!screen);
    setScreen(ctrl.call.screenOn);
    ctrl.publishMediaState();
    if (ctrl.call.screenOn) setTab('call');
  }

  async function copy(kind: 'code' | 'link') {
    const text = kind === 'code' ? expected : inviteUrl(expected);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* ignore */
    }
  }

  async function share() {
    const url = inviteUrl(expected);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'CipherRoom invite', text: `Join CipherRoom ${expected}`, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    await copy('link');
  }

  const showCall = tab === 'call' || cam || screen || peers.some((p) => p.videoEnabled);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass sticky top-0 z-20 flex items-center justify-between gap-3 rounded-none border-x-0 border-t-0 px-3 py-2.5 sm:px-5">
        <Logo compact />
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">Secure room</div>
          <div className="flex items-center gap-2 font-mono text-lg tracking-[0.28em] text-white">
            {expected}
            <button className="text-cyan-glow" aria-label="Copy room code" onClick={() => void copy('code')}>
              {copied === 'code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="hidden items-center gap-1 rounded-full border border-mint/30 bg-mint/10 px-2 py-1 text-mint sm:inline-flex">
            <Shield className="h-3 w-3" /> Encrypted session
          </span>
          <span className="rounded-full border border-white/10 px-2 py-1 text-slate-300">
            {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
          </span>
          <span
            className={`inline-flex items-center gap-1 ${connection === 'connected' ? 'text-mint' : 'text-amber-300'}`}
            title={connection}
          >
            {connection === 'connected' ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span className="hidden sm:inline">{connection === 'connected' ? 'Connected' : 'Reconnecting'}</span>
          </span>
        </div>
      </header>

      <div className="px-3 pt-2 sm:px-5">
        <div className="rounded-xl border border-cyan-glow/15 bg-cyan-glow/5 px-3 py-2 text-center text-xs text-cyan-100/80">
          {banner} {cryptoReady ? '· Client-side keys ready.' : '· Establishing encryption keys…'}
        </div>
      </div>

      {perm && (
        <div className="mx-3 mt-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100 sm:mx-5" role="status">
          {perm}
          <button className="ml-3 underline" onClick={() => setPerm(null)}>
            dismiss
          </button>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 p-3 sm:p-5 lg:flex-row">
        {(tab === 'call' || (showCall && tab !== 'people')) && (
          <section className={`${tab === 'chat' ? 'hidden lg:flex' : 'flex'} min-h-[240px] flex-1 flex-col`}>
            <VideoGrid
              selfId={participantId}
              selfName={name}
              localStream={localStream}
              cameraOn={cam}
              peers={peers}
              participants={participants}
              quality={quality}
              spotlight={spotlight}
              onSpotlight={setSpotlight}
            />
          </section>
        )}

        {(tab === 'chat' || tab === 'call') && (
          <section className={`${tab === 'call' ? 'hidden lg:flex' : 'flex'} w-full flex-col lg:max-w-md`}>
            <ChatPanel />
          </section>
        )}

        {tab === 'people' && (
          <PeoplePanel
            selfId={participantId}
            quality={quality}
            onInvite={() => setInviteOpen(true)}
          />
        )}
      </div>

      <nav className="sticky bottom-0 z-20 border-t border-white/10 bg-[#070b12]/90 px-2 py-2 backdrop-blur-xl sm:px-4">
        <div className="mx-auto flex max-w-4xl items-center justify-center gap-1 sm:gap-2">
          <Control label={mic ? 'Mute' : 'Mic'} on={mic} off={!mic} onClick={() => void toggleMic()}>
            {mic ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Control>
          <Control label={cam ? 'Camera' : 'Camera'} on={cam} off={!cam} onClick={() => void toggleCam()}>
            {cam ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Control>
          <Control label="Screen" on={screen} onClick={() => void toggleScreen()}>
            <MonitorUp className="h-5 w-5" />
          </Control>
          <Control label="People" onClick={() => setTab('people')}>
            <Users className="h-5 w-5" />
          </Control>
          <Control label="Chat" onClick={() => setTab('chat')}>
            <MessageSquare className="h-5 w-5" />
          </Control>
          <Control label="Invite" onClick={() => setInviteOpen(true)}>
            <Link2 className="h-5 w-5" />
          </Control>
          <Control label="Settings" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-5 w-5" />
          </Control>
          <Control label="Leave" danger onClick={() => setLeaveOpen(true)}>
            <PhoneOff className="h-5 w-5" />
          </Control>
        </div>
        <div className="mt-2 flex justify-center gap-1 lg:hidden">
          <TabBtn active={tab === 'chat'} onClick={() => setTab('chat')} icon={<MessageSquare className="h-4 w-4" />} label="Chat" />
          <TabBtn active={tab === 'call'} onClick={() => setTab('call')} icon={<Video className="h-4 w-4" />} label="Call" />
          <TabBtn active={tab === 'people'} onClick={() => setTab('people')} icon={<Users className="h-4 w-4" />} label="People" />
        </div>
      </nav>

      {inviteOpen && <InviteShare code={expected} onClose={() => setInviteOpen(false)} />}

      {leaveOpen && (
        <Modal title="Leave room?" onClose={() => setLeaveOpen(false)}>
          <p className="text-sm text-slate-400">
            If you are the last participant, the room will be destroyed after a short grace period.
          </p>
          <div className="mt-5 flex gap-3">
            <button className="btn btn-ghost flex-1" onClick={() => setLeaveOpen(false)}>
              Stay
            </button>
            <button
              className="btn btn-danger flex-1"
              onClick={() => {
                getController().leave();
              }}
            >
              Leave
            </button>
          </div>
        </Modal>
      )}

      {settingsOpen && (
        <Modal title="Devices" onClose={() => setSettingsOpen(false)}>
          <label className="text-xs uppercase tracking-wider text-slate-400">Camera</label>
          <select
            className="field mb-3 mt-1"
            value={ctrl.call.selectedCamera ?? ''}
            onChange={(e) => void ctrl.call.switchCamera(e.target.value)}
          >
            <option value="">Default</option>
            {devices.cameras.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || 'Camera'}
              </option>
            ))}
          </select>
          <label className="text-xs uppercase tracking-wider text-slate-400">Microphone</label>
          <select
            className="field mb-3 mt-1"
            value={ctrl.call.selectedMic ?? ''}
            onChange={(e) => void ctrl.call.switchMic(e.target.value)}
          >
            <option value="">Default</option>
            {devices.mics.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || 'Microphone'}
              </option>
            ))}
          </select>
          <label className="text-xs uppercase tracking-wider text-slate-400">Speaker</label>
          <select
            className="field mt-1"
            value={ctrl.call.selectedSpeaker ?? ''}
            onChange={(e) => void ctrl.call.switchSpeaker(e.target.value)}
          >
            <option value="">Default</option>
            {devices.speakers.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || 'Speaker'}
              </option>
            ))}
          </select>
          <button className="btn btn-ghost mt-4 w-full" onClick={() => void copy('link')}>
            {copied === 'link' ? 'Invite link copied' : 'Copy invite link'}
          </button>
        </Modal>
      )}
    </div>
  );
}

function Control({
  label,
  children,
  onClick,
  on,
  off,
  danger,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  on?: boolean;
  off?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      className={`control-btn ${on ? 'on' : ''} ${off ? 'off' : ''} ${danger ? 'off' : ''}`}
      onClick={onClick}
      aria-label={label}
    >
      {children}
      <span className="text-[10px] uppercase tracking-wide">{label}</span>
    </button>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs ${active ? 'bg-cyan-glow/15 text-cyan-glow' : 'text-slate-400'}`}
    >
      {icon}
      {label}
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="glass w-full max-w-md rounded-3xl p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function VideoGrid({
  selfId,
  selfName,
  localStream,
  cameraOn,
  peers,
  participants,
  quality,
  spotlight,
  onSpotlight,
}: {
  selfId: string;
  selfName: string;
  localStream: MediaStream | null;
  cameraOn: boolean;
  peers: PeerMedia[];
  participants: { id: string; name: string; camera: boolean; microphone: boolean }[];
  quality: Record<string, number>;
  spotlight: string | null;
  onSpotlight: (id: string | null) => void;
}) {
  const tiles = [
    { id: selfId, name: selfName, stream: localStream, self: true, camera: cameraOn },
    ...peers.map((p) => ({
      id: p.id,
      name: participants.find((x) => x.id === p.id)?.name ?? 'Guest',
      stream: p.stream,
      self: false,
      camera: p.videoEnabled,
      state: p.connectionState,
    })),
  ];
  const shown = spotlight ? tiles.filter((t) => t.id === spotlight) : tiles;
  return (
    <div className={`grid flex-1 gap-3 ${shown.length === 1 ? 'grid-cols-1' : shown.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'}`}>
      {shown.map((t) => (
        <div key={t.id} className="video-tile group">
          {t.stream && (t.camera || t.stream.getVideoTracks().length > 0) ? (
            <VideoEl stream={t.stream} muted={t.self} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full text-xl font-semibold text-ink-950"
                style={{ background: participantColor(t.id) }}
              >
                {initials(t.name)}
              </div>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-sm">
            <span>
              {t.name}
              {t.self ? ' (you)' : ''}
            </span>
            <span className="flex items-center gap-2">
              <QualityBars n={quality[t.id] ?? (t.self ? 3 : 2)} />
              <button
                className="opacity-0 group-hover:opacity-100"
                aria-label="Full screen"
                onClick={() => onSpotlight(spotlight === t.id ? null : t.id)}
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function VideoEl({ stream, muted }: { stream: MediaStream; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} />;
}

function QualityBars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-end gap-0.5" aria-label={`Connection quality ${n} of 3`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`w-1 rounded-sm ${i <= n ? 'bg-mint' : 'bg-white/20'}`}
          style={{ height: 4 + i * 3 }}
        />
      ))}
    </span>
  );
}

function ChatPanel() {
  const messages = useSession((s) => s.messages);
  const typing = useSession((s) => s.typing);
  const selfId = useSession((s) => s.participantId);
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<number | null>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function onChange(v: string) {
    setText(v);
    getController().setTyping(true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => getController().setTyping(false), 1500);
  }

  async function send() {
    const t = text;
    setText('');
    setEmojiOpen(false);
    getController().setTyping(false);
    await getController().sendText(t);
  }

  const typingLabel = Object.values(typing).filter(Boolean);
  const quick = ['👍', '😂', '🔥', '🎉', '❤️', '👋', '✅', '👀', '😅', '🚀'];

  return (
    <div className="glass flex h-[min(70dvh,720px)] flex-col rounded-2xl lg:h-full">
      <div className="border-b border-white/5 px-4 py-3 text-sm font-medium text-slate-300">Conversation</div>
      <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-slate-500">No messages yet. Say hello — it never leaves this session.</p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} self={m.from === selfId || m.self} />
        ))}
        <div ref={bottom} />
      </div>
      {typingLabel.length > 0 && (
        <div className="px-4 pb-1 text-xs text-slate-500">{typingLabel.join(', ')} typing…</div>
      )}
      <div className="border-t border-white/5 p-3">
        {emojiOpen && (
          <div className="mb-2 flex flex-wrap gap-1">
            {quick.map((e) => (
              <button
                key={e}
                className="rounded-lg p-1 text-xl hover:bg-white/10"
                onClick={() => {
                  setText((t) => t + e);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <button type="button" className="control-btn !h-12 !w-12" aria-label="Attach file" onClick={() => fileRef.current?.click()}>
            <Paperclip className="h-5 w-5" />
          </button>
          <button type="button" className="control-btn !h-12 !w-12" aria-label="Emoji" onClick={() => setEmojiOpen((v) => !v)}>
            <Smile className="h-5 w-5" />
          </button>
          <textarea
            className="field min-h-12 flex-1 resize-none py-3"
            rows={1}
            placeholder="Message the room…"
            value={text}
            maxLength={useSession.getState().config?.maxMessageChars ?? 4000}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button className="btn btn-primary !px-4" type="submit" aria-label="Send">
            <Send className="h-4 w-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void getController().sendFile(f);
              e.target.value = '';
            }}
          />
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ m, self }: { m: ChatLine; self: boolean }) {
  const [menu, setMenu] = useState(false);
  if (m.kind === 'system') {
    return <div className="msg-enter text-center text-xs text-slate-500">{m.text}</div>;
  }
  if (m.status === 'retracted') {
    return <div className="msg-enter text-center text-xs italic text-slate-600">Message removed</div>;
  }
  return (
    <div className={`msg-enter flex ${self ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${self ? 'bg-cyan-glow/15 text-white' : 'bg-white/5 text-slate-100'}`}>
        <div className="mb-0.5 flex items-center gap-2 text-[11px] text-slate-400">
          <span className="font-medium" style={{ color: participantColor(m.from) }}>
            {m.fromName}
          </span>
          <span>{formatTime(m.ts)}</span>
        </div>
        {m.kind === 'image' && m.imageUrl && (
          <img src={m.imageUrl} alt={m.fileName ?? 'image'} className="mb-1 max-h-64 rounded-xl" />
        )}
        {m.kind === 'file' && m.fileUrl && (
          <a className="mb-1 block text-cyan-glow underline" href={m.fileUrl} download={m.fileName}>
            {m.fileName}
          </a>
        )}
        {m.kind === 'text' && <p className="whitespace-pre-wrap break-words text-sm">{linkify(m.text)}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {Object.entries(m.reactions).map(
            ([emoji, ids]) =>
              ids.length > 0 && (
                <span key={emoji} className="rounded-full bg-white/10 px-1.5 text-xs">
                  {emoji} {ids.length}
                </span>
              ),
          )}
          <button className="text-[11px] text-slate-500 hover:text-white" onClick={() => setMenu((v) => !v)}>
            …
          </button>
        </div>
        {menu && (
          <div className="mt-1 flex flex-wrap gap-1">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => getController().react(m.id, e)}>
                {e}
              </button>
            ))}
            <button
              className="text-[11px] text-slate-400"
              onClick={() => {
                void navigator.clipboard.writeText(m.text);
                setMenu(false);
              }}
            >
              Copy
            </button>
            {self && (
              <button className="text-[11px] text-rose-300" onClick={() => getController().retract(m.id)}>
                Delete
              </button>
            )}
            {!self && (
              <button
                className="text-[11px] text-slate-400"
                onClick={() => {
                  useSession.getState().set({
                    messages: useSession.getState().messages.filter((x) => x.id !== m.id),
                  });
                }}
              >
                Hide
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) => {
    if (/^https?:\/\//.test(p)) {
      return (
        <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="text-cyan-glow underline">
          {p}
        </a>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function PeoplePanel({
  selfId,
  quality,
  onInvite,
}: {
  selfId: string;
  quality: Record<string, number>;
  onInvite: () => void;
}) {
  const participants = useSession((s) => s.participants);
  return (
    <div className="glass w-full flex-1 rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">Participants</h2>
        <button className="btn btn-ghost !min-h-10 !px-3 !py-2 text-xs" onClick={onInvite}>
          Invite / QR
        </button>
      </div>
      <ul className="space-y-2">
        {participants.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-ink-950"
              style={{ background: participantColor(p.id) }}
            >
              {initials(p.name)}
            </div>
            <div className="flex-1">
              <div className="text-sm">
                {p.name}
                {p.id === selfId ? ' (you)' : ''}
              </div>
              <div className="text-[11px] text-slate-500">
                {p.camera ? 'Camera on' : 'Camera off'} · {p.microphone ? 'Mic on' : 'Muted'}
              </div>
            </div>
            <QualityBars n={quality[p.id] ?? 3} />
          </li>
        ))}
      </ul>
    </div>
  );
}
