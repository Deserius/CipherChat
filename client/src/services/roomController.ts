import type { ServerMessage, PublicParticipant } from '@shared/protocol';
import { RoomCrypto, bytesToB64, b64ToBytes } from '../crypto/roomCrypto';
import { WsClient } from './wsClient';
import { CallManager, listDevices } from '../webrtc/callManager';
import { useSession, type ChatLine } from '../stores/session';
import { notifyJoin } from './permissions';

const CHUNK = 48 * 1024;
const EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👋', '✅', '👀'];

function rid() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export { EMOJIS };

export class RoomController {
  ws = new WsClient();
  crypto = new RoomCrypto();
  call: CallManager;
  private joinPayload: { name: string; roomCode?: string; createRandom?: boolean } | null = null;
  private keyWaiters: Array<() => void> = [];
  private files = new Map<string, { meta: { name: string; mime: string; iv: string; total: number; kind: 'image' | 'file'; from: string; fromName: string }; chunks: (Uint8Array | undefined)[] }>();
  private announced = false;
  private wrapping = false;
  private queue: Promise<void> = Promise.resolve();
  pendingStream: MediaStream | null = null;
  notifyOnJoin = false;
  onDevices: (d: Awaited<ReturnType<typeof listDevices>>) => void = () => {};
  onPeerMedia: CallManager['onPeers'] = () => {};
  onLocalStream: CallManager['onLocalStream'] = () => {};
  onQuality: CallManager['onQuality'] = () => {};

  constructor() {
    this.call = new CallManager(this.ws);
    this.ws.onMessage = (m) => {
      this.queue = this.queue.then(() => this.onServer(m)).catch((err) => console.warn(err));
    };
    this.ws.onStatus = (s) => {
      const st = useSession.getState();
      if (s === 'connecting') {
        useSession.getState().set({
          connection: st.phase === 'room' ? 'reconnecting' : 'connecting',
          phase: st.phase === 'room' || st.phase === 'reconnecting' ? 'reconnecting' : 'connecting',
        });
      } else if (s === 'open') {
        this.tryJoin();
      } else if (s === 'closed' || s === 'error') {
        const phase = useSession.getState().phase;
        if (phase === 'room' || phase === 'reconnecting' || phase === 'connecting') {
          useSession.getState().set({ connection: 'reconnecting', phase: 'reconnecting' });
        }
      }
    };
    this.call.onPeers = (p) => this.onPeerMedia(p);
    this.call.onLocalStream = (s) => this.onLocalStream(s);
    this.call.onError = (msg) => useSession.getState().set({ mediaError: msg });
    this.call.onQuality = (id, score) => this.onQuality(id, score);
  }

  async enter(opts: { name: string; roomCode?: string; createRandom?: boolean }) {
    this.joinPayload = opts;
    useSession.getState().set({
      phase: 'connecting',
      name: opts.name,
      roomCode: opts.roomCode ?? '',
      errorMessage: undefined,
      errorCode: undefined,
      messages: [],
      participants: [],
    });
    await this.crypto.init();
    this.ws.connect();
  }

  private tryJoin() {
    const p = this.joinPayload;
    if (!p) return;
    const token = useSession.getState().sessionToken || undefined;
    this.ws.send({
      type: 'join',
      name: p.name,
      roomCode: p.roomCode,
      createRandom: p.createRandom,
      sessionToken: token,
    });
  }

  leave() {
    this.ws.send({ type: 'leave' });
    this.teardown();
    useSession.getState().set({ phase: 'left', connection: 'idle' });
  }

  teardown() {
    this.call.hangup();
    this.crypto.destroy();
    this.ws.disconnect();
    this.announced = false;
    this.files.clear();
    this.joinPayload = null;
  }

  async sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    await this.ensureKey();
    const id = rid();
    const { ciphertext, iv } = await this.crypto.encrypt(trimmed);
    const line: ChatLine = {
      id,
      from: useSession.getState().participantId,
      fromName: useSession.getState().name,
      text: trimmed,
      kind: 'text',
      ts: Date.now(),
      self: true,
      status: 'sent',
      reactions: {},
    };
    useSession.getState().addMessage(line);
    this.ws.send({ type: 'chat', ciphertext, iv, kind: 'text', clientId: id });
  }

  setTyping(isTyping: boolean) {
    this.ws.send({ type: 'typing', isTyping });
  }

  react(messageId: string, emoji: string) {
    const st = useSession.getState();
    const msg = st.messages.find((m) => m.id === messageId);
    if (!msg) return;
    const mine = st.participantId;
    const next = { ...msg.reactions };
    const list = new Set(next[emoji] ?? []);
    if (list.has(mine)) list.delete(mine);
    else list.add(mine);
    next[emoji] = [...list];
    st.patchMessage(messageId, { reactions: next });
    this.ws.send({ type: 'reaction', messageId, emoji });
  }

  retract(messageId: string) {
    useSession.getState().patchMessage(messageId, { status: 'retracted', text: '', imageUrl: undefined, fileUrl: undefined });
    this.ws.send({ type: 'retract', messageId });
  }

  async sendFile(file: File) {
    await this.ensureKey();
    if (file.size > (useSession.getState().config?.maxFileBytes ?? 8_000_000)) {
      useSession.getState().set({ mediaError: 'File exceeds the maximum size.' });
      return;
    }
    const buf = await file.arrayBuffer();
    const { ciphertext, iv } = await this.crypto.encryptFile(buf);
    const bytes = new Uint8Array(ciphertext);
    const total = Math.max(1, Math.ceil(bytes.length / CHUNK));
    const fileId = rid();
    const kind = file.type.startsWith('image/') ? 'image' : 'file';
    this.ws.send({
      type: 'file-meta',
      fileId,
      name: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      iv,
      totalChunks: total,
      kind,
    });
    for (let i = 0; i < total; i++) {
      const slice = bytes.subarray(i * CHUNK, (i + 1) * CHUNK);
      this.ws.send({
        type: 'file-chunk',
        fileId,
        index: i,
        total,
        data: bytesToB64(slice),
      });
    }
    const url = URL.createObjectURL(file);
    useSession.getState().addMessage({
      id: fileId,
      from: useSession.getState().participantId,
      fromName: useSession.getState().name,
      text: file.name,
      kind,
      ts: Date.now(),
      self: true,
      status: 'sent',
      fileName: file.name,
      mime: file.type,
      imageUrl: kind === 'image' ? url : undefined,
      fileUrl: url,
      reactions: {},
    });
  }

  private async ensureKey() {
    if (this.crypto.ready) return;
    await new Promise<void>((resolve) => {
      const t = window.setTimeout(resolve, 8000);
      this.keyWaiters.push(() => {
        window.clearTimeout(t);
        resolve();
      });
    });
    if (!this.crypto.ready) {
      await this.crypto.becomeKeyHolder();
      this.flushKeyWaiters();
      await this.wrapAll();
    }
  }

  private flushKeyWaiters() {
    const w = this.keyWaiters.splice(0);
    w.forEach((fn) => fn());
  }

  private async announceKeys() {
    if (this.announced || !this.crypto.publicKeyB64) return;
    this.announced = true;
    this.ws.send({ type: 'key-announce', publicKey: this.crypto.publicKeyB64 });
    // If we are alone, we mint the room key.
    const others = useSession.getState().participants.filter(
      (p) => p.id !== useSession.getState().participantId,
    );
    if (others.length === 0) {
      await this.crypto.becomeKeyHolder();
      this.flushKeyWaiters();
      useSession.getState().set({ cryptoReady: true });
      await this.wrapAll();
    }
  }

  private async wrapAll() {
    if (this.wrapping || !this.crypto.roomKey) return;
    this.wrapping = true;
    try {
      for (const [peerId] of this.crypto.peerKeys) {
        if (this.crypto.wrappedFor.has(peerId)) continue;
        const wrapped = await this.crypto.wrapForPeer(peerId);
        if (wrapped) {
          this.ws.send({
            type: 'key-wrap',
            to: peerId,
            wrappedKey: wrapped.wrappedKey,
            iv: wrapped.iv,
            senderPublicKey: wrapped.senderPublicKey,
          });
        }
      }
    } finally {
      this.wrapping = false;
    }
  }

  private async onServer(msg: ServerMessage) {
    const st = useSession.getState();
    switch (msg.type) {
      case 'welcome':
        st.set({ config: msg.config, iceServers: msg.iceServers });
        break;
      case 'joined': {
        st.set({
          phase: 'room',
          connection: 'connected',
          roomCode: msg.roomCode,
          participantId: msg.participantId,
          sessionToken: msg.sessionToken,
          participants: msg.participants,
          created: msg.created,
          iceServers: msg.iceServers,
        });
        try {
          sessionStorage.setItem('cipherroom.session', msg.sessionToken);
        } catch {
          /* private mode */
        }
        this.call.configure(msg.participantId, msg.iceServers as RTCIceServer[]);
        this.call.startStats();
        if (this.pendingStream) {
          this.call.attachExistingStream(this.pendingStream);
          this.pendingStream = null;
          this.publishMediaState();
        }
        for (const p of msg.participants) {
          if (p.id !== msg.participantId) await this.call.ensurePeer(p.id);
        }
        await this.announceKeys();
        break;
      }
      case 'participant-joined': {
        const exists = st.participants.some((p) => p.id === msg.participant.id);
        const participants = exists
          ? st.participants.map((p) => (p.id === msg.participant.id ? msg.participant : p))
          : [...st.participants, msg.participant];
        st.set({ participants });
        await this.call.ensurePeer(msg.participant.id);
        if (this.crypto.roomKey) await this.wrapAll();
        break;
      }
      case 'participant-left': {
        st.set({
          participants: st.participants.filter((p) => p.id !== msg.participantId),
          typing: Object.fromEntries(Object.entries(st.typing).filter(([k]) => k !== msg.participantId)),
        });
        this.call.removePeer(msg.participantId);
        this.crypto.peerKeys.delete(msg.participantId);
        this.crypto.wrappedFor.delete(msg.participantId);
        break;
      }
      case 'system':
        st.addMessage({
          id: rid(),
          from: 'system',
          fromName: 'system',
          text: msg.text,
          kind: 'system',
          ts: msg.ts,
          self: false,
          status: 'delivered',
          reactions: {},
        });
        break;
      case 'chat':
        await this.onChat(msg);
        break;
      case 'typing': {
        const typing = { ...st.typing };
        if (msg.isTyping) typing[msg.from] = msg.fromName;
        else delete typing[msg.from];
        st.set({ typing });
        break;
      }
      case 'signal':
        await this.call.handleSignal(msg.from, msg.data);
        break;
      case 'key-announce':
        await this.crypto.addPeerPublicKey(msg.from, msg.publicKey);
        if (this.crypto.roomKey) await this.wrapAll();
        break;
      case 'key-wrap':
        if (!this.crypto.ready) {
          try {
            await this.crypto.acceptWrappedKey(msg.wrappedKey, msg.iv, msg.senderPublicKey);
            useSession.getState().set({ cryptoReady: true });
            this.flushKeyWaiters();
            this.ws.send({ type: 'key-announce', publicKey: this.crypto.publicKeyB64! });
          } catch (e) {
            console.warn('key unwrap failed', e);
          }
        }
        break;
      case 'file-meta':
        this.files.set(msg.fileId, {
          meta: {
            name: msg.name,
            mime: msg.mime,
            iv: msg.iv,
            total: msg.totalChunks,
            kind: msg.kind,
            from: msg.from,
            fromName: msg.fromName,
          },
          chunks: new Array(msg.totalChunks),
        });
        break;
      case 'file-chunk':
        await this.onFileChunk(msg);
        break;
      case 'reaction': {
        const m = st.messages.find((x) => x.id === msg.messageId);
        if (!m) break;
        const next = { ...m.reactions };
        const list = new Set(next[msg.emoji] ?? []);
        if (list.has(msg.from)) list.delete(msg.from);
        else list.add(msg.from);
        next[msg.emoji] = [...list];
        st.patchMessage(msg.messageId, { reactions: next });
        break;
      }
      case 'retract':
        st.patchMessage(msg.messageId, {
          status: 'retracted',
          text: '',
          imageUrl: undefined,
          fileUrl: undefined,
        });
        break;
      case 'media-state': {
        const participants = st.participants.map((p) =>
          p.id === msg.from
            ? { ...p, camera: msg.camera, microphone: msg.microphone, screen: msg.screen }
            : p,
        );
        st.set({ participants });
        break;
      }
      case 'error':
        st.set({
          phase: st.phase === 'room' || st.phase === 'reconnecting' ? st.phase : 'error',
          errorCode: msg.code,
          errorMessage: msg.message,
          connection: st.phase === 'room' ? st.connection : 'idle',
        });
        break;
      case 'rate-limited':
        st.set({ mediaError: 'Too many join attempts. Please wait.' });
        break;
      case 'room-destroyed':
        this.call.hangup();
        this.crypto.destroy();
        this.ws.disconnect();
        st.set({
          phase: 'destroyed',
          destroyedReason: msg.reason,
          connection: 'idle',
          participants: [],
        });
        break;
      default:
        break;
    }
  }

  private async onChat(msg: Extract<ServerMessage, { type: 'chat' }>) {
    let text = '';
    try {
      await this.ensureKey();
      text = await this.crypto.decrypt(msg.ciphertext, msg.iv);
    } catch {
      text = 'Unable to decrypt this message.';
    }
    useSession.getState().addMessage({
      id: msg.clientId,
      from: msg.from,
      fromName: msg.fromName,
      text,
      kind: msg.kind ?? 'text',
      ts: msg.ts,
      self: false,
      status: 'delivered',
      reactions: {},
    });
  }

  private async onFileChunk(msg: Extract<ServerMessage, { type: 'file-chunk' }>) {
    const rec = this.files.get(msg.fileId);
    if (!rec) return;
    rec.chunks[msg.index] = b64ToBytes(msg.data);
    if (rec.chunks.some((c) => !c)) return;
    const total = rec.chunks.reduce((n, c) => n + (c?.length ?? 0), 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of rec.chunks) {
      out.set(c!, off);
      off += c!.length;
    }
    try {
      await this.ensureKey();
      const plain = await this.crypto.decryptFile(out.buffer, rec.meta.iv);
      const blob = new Blob([plain], { type: rec.meta.mime });
      const url = URL.createObjectURL(blob);
      useSession.getState().addMessage({
        id: msg.fileId,
        from: rec.meta.from,
        fromName: rec.meta.fromName,
        text: rec.meta.name,
        kind: rec.meta.kind,
        ts: Date.now(),
        self: false,
        status: 'delivered',
        fileName: rec.meta.name,
        mime: rec.meta.mime,
        fileUrl: url,
        imageUrl: rec.meta.kind === 'image' ? url : undefined,
        reactions: {},
      });
    } catch {
      useSession.getState().addMessage({
        id: msg.fileId,
        from: rec.meta.from,
        fromName: rec.meta.fromName,
        text: 'Unable to decrypt file.',
        kind: 'system',
        ts: Date.now(),
        self: false,
        status: 'failed',
        reactions: {},
      });
    } finally {
      this.files.delete(msg.fileId);
    }
  }

  publishMediaState() {
    this.ws.send({
      type: 'media-state',
      camera: this.call.cameraOn,
      microphone: this.call.micOn,
      screen: this.call.screenOn,
    });
    const st = useSession.getState();
    st.set({
      participants: st.participants.map((p) =>
        p.id === st.participantId
          ? { ...p, camera: this.call.cameraOn, microphone: this.call.micOn, screen: this.call.screenOn }
          : p,
      ),
    });
  }

  async refreshDevices() {
    this.onDevices(await listDevices());
  }
}

let singleton: RoomController | null = null;
export function getController() {
  if (!singleton) singleton = new RoomController();
  return singleton;
}

export function participantColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hues = [186, 164, 262, 42, 332, 198, 142];
  return `hsl(${hues[h % hues.length]} 80% 55%)`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function inviteUrl(code: string) {
  return `${location.origin}/r/${code}`;
}

export function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
