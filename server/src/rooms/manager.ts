import type { WebSocket } from 'ws';
import type { PublicParticipant, ServerMessage } from '../../../shared/protocol.ts';
import type { RoomTheme } from '../../../shared/avatars.ts';
import { config } from '../config.ts';
import { generateId, generateRoomCode, generateToken } from '../security/cryptoRandom.ts';
import { LOBBIES, lobbyBySlug, lobbyDisplayName } from '../../../shared/lobbies.ts';

export interface Participant {
  id: string;
  name: string;
  sessionToken: string;
  ws: WebSocket | null;
  joinedAt: number;
  lastSeen: number;
  camera: boolean;
  microphone: boolean;
  screen: boolean;
  avatar?: string;
  connected: boolean;
  messageWindowStart: number;
  messageCount: number;
  graceTimer: ReturnType<typeof setTimeout> | null;
  plan: 'free' | 'plus' | 'pro';
  maxFileBytes: number;
}

export interface Room {
  code: string;
  createdAt: number;
  lastActivity: number;
  participants: Map<string, Participant>;
  destroyTimer: ReturnType<typeof setTimeout> | null;
  lifetimeTimer: ReturnType<typeof setTimeout> | null;
  inactivityTimer: ReturnType<typeof setTimeout> | null;
  destroyed: boolean;
  maxParticipants: number;
  holdMs: number;
  maxLifetimeMs: number;
  plan: 'free' | 'plus' | 'pro';
  kind: 'code' | 'lobby' | 'party';
  title?: string;
  lobbySlug?: string;
  lobbyIndex?: number;
  hostId?: string;
  theme?: RoomTheme;
}

export type RoomEvent =
  | { type: 'destroyed'; code: string; reason: 'empty' | 'expired' | 'inactivity' | 'max-lifetime' | 'shutdown' }
  | { type: 'created'; code: string };

type SendFn = (ws: WebSocket, msg: ServerMessage) => void;

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  readonly sessions = new Map<string, { roomCode: string; participantId: string }>();
  private send: SendFn;
  onEvent?: (e: RoomEvent) => void;

  constructor(send: SendFn) {
    this.send = send;
  }

  stats() {
    let participants = 0;
    let connections = 0;
    for (const room of this.rooms.values()) {
      participants += room.participants.size;
      for (const p of room.participants.values()) if (p.connected) connections++;
    }
    return { rooms: this.rooms.size, participants, connections };
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  generateUniqueCode(digits = config.roomCodeLength): string {
    for (let i = 0; i < 32; i++) {
      const code = generateRoomCode(digits);
      if (!this.rooms.has(code)) return code;
    }
    // Extremely unlikely fallback: try a longer code
    const longer = Math.min(10, digits + 1);
    for (let i = 0; i < 16; i++) {
      const code = generateRoomCode(longer);
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('server-error');
  }

  joinOrCreate(opts: {
    name: string;
    roomCode?: string;
    createRandom?: boolean;
    sessionToken?: string;
    ws: WebSocket;
    plan?: 'free' | 'plus' | 'pro';
    maxParticipants?: number;
    holdMs?: number;
    maxLifetimeMs?: number;
    maxFileBytes?: number;
    kind?: Room['kind'];
    avatar?: string;
  }): { room: Room; participant: Participant; created: boolean } {
    // Resume existing session if token is still valid
    if (opts.sessionToken) {
      const existing = this.sessions.get(opts.sessionToken);
      if (existing) {
        const room = this.rooms.get(existing.roomCode);
        const p = room?.participants.get(existing.participantId);
        if (room && p && !room.destroyed) {
          this.attachSocket(room, p, opts.ws);
          if (opts.avatar) p.avatar = opts.avatar;
          return { room, participant: p, created: false };
        }
      }
    }

    let code = opts.roomCode;
    let created = false;
    if (opts.createRandom || !code) {
      code = this.generateUniqueCode();
      created = true;
    }

    let room = this.rooms.get(code);
    if (!room) {
      room = this.createRoom(code, {
        maxParticipants: opts.maxParticipants,
        holdMs: opts.holdMs,
        maxLifetimeMs: opts.maxLifetimeMs,
        plan: opts.plan,
        kind: opts.kind,
      });
      created = true;
    }
    if (room.destroyed) {
      throw Object.assign(new Error('room-expired'), { code: 'room-expired' });
    }
    if (room.participants.size >= room.maxParticipants) {
      throw Object.assign(new Error('room-full'), { code: 'room-full' });
    }

    const participant = this.addParticipant(room, opts.name, opts.ws, {
      plan: opts.plan,
      maxFileBytes: opts.maxFileBytes,
      avatar: opts.avatar,
    });
    this.touch(room);
    return { room, participant, created };
  }

  createRoom(
    code: string,
    limits?: {
      maxParticipants?: number;
      holdMs?: number;
      maxLifetimeMs?: number;
      plan?: 'free' | 'plus' | 'pro';
      kind?: Room['kind'];
      title?: string;
      lobbySlug?: string;
      lobbyIndex?: number;
    },
  ): Room {
    const maxLifetimeMs = limits?.maxLifetimeMs ?? config.roomMaxLifetimeMs;
    const room: Room = {
      code,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      participants: new Map(),
      destroyTimer: null,
      lifetimeTimer: null,
      inactivityTimer: null,
      destroyed: false,
      maxParticipants: limits?.maxParticipants ?? config.maxParticipants,
      holdMs: limits?.holdMs ?? config.roomDestroyGraceMs,
      maxLifetimeMs,
      plan: limits?.plan ?? 'free',
      kind: limits?.kind ?? 'code',
      title: limits?.title,
      lobbySlug: limits?.lobbySlug,
      lobbyIndex: limits?.lobbyIndex,
    };
    if (maxLifetimeMs > 0) {
      room.lifetimeTimer = setTimeout(() => {
        this.destroyRoom(code, 'max-lifetime');
      }, maxLifetimeMs);
    }
    this.resetInactivity(room);
    this.rooms.set(code, room);
    this.onEvent?.({ type: 'created', code });
    return room;
  }

  addParticipant(
    room: Room,
    name: string,
    ws: WebSocket,
    extras?: { plan?: 'free' | 'plus' | 'pro'; maxFileBytes?: number; avatar?: string },
  ): Participant {
    const id = generateId();
    const sessionToken = generateToken(32);
    const p: Participant = {
      id,
      name,
      sessionToken,
      ws,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      camera: false,
      microphone: false,
      screen: false,
      avatar: extras?.avatar,
      connected: true,
      messageWindowStart: Date.now(),
      messageCount: 0,
      graceTimer: null,
      plan: extras?.plan ?? 'free',
      maxFileBytes: extras?.maxFileBytes ?? config.maxFileBytes,
    };
    room.participants.set(id, p);
    if (!room.hostId) room.hostId = id;
    this.sessions.set(sessionToken, { roomCode: room.code, participantId: id });
    this.cancelDestroy(room);
    return p;
  }

  attachSocket(room: Room, p: Participant, ws: WebSocket) {
    if (p.graceTimer) {
      clearTimeout(p.graceTimer);
      p.graceTimer = null;
    }
    p.ws = ws;
    p.connected = true;
    p.lastSeen = Date.now();
    this.cancelDestroy(room);
  }

  markDisconnected(participantId: string) {
    const found = this.findParticipant(participantId);
    if (!found) return;
    const { room, participant } = found;
    participant.connected = false;
    participant.ws = null;
    participant.lastSeen = Date.now();
    if (participant.graceTimer) clearTimeout(participant.graceTimer);
    participant.graceTimer = setTimeout(() => {
      this.removeParticipant(room.code, participant.id, 'timeout');
    }, config.participantGraceMs);
  }

  removeParticipant(roomCode: string, participantId: string, _reason: 'leave' | 'timeout' | 'kick' = 'leave') {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const p = room.participants.get(participantId);
    if (!p) return;
    if (p.graceTimer) clearTimeout(p.graceTimer);
    this.sessions.delete(p.sessionToken);
    room.participants.delete(participantId);
    try {
      p.ws?.close(1000, 'left');
    } catch {
      /* ignore */
    }
    this.broadcast(
      room,
      {
        type: 'participant-left',
        participantId: p.id,
        name: p.name,
      },
      participantId,
    );
    this.broadcast(room, {
      type: 'system',
      event: 'left',
      text: `${p.name} left the room`,
      ts: Date.now(),
    });
    if (this.connectedCount(room) === 0 && room.participants.size === 0) {
      this.scheduleDestroy(room);
    } else if (this.connectedCount(room) === 0) {
      // only disconnected-in-grace remain
      this.scheduleDestroy(room);
    }
  }

  leave(participantId: string) {
    const found = this.findParticipant(participantId);
    if (!found) return;
    this.removeParticipant(found.room.code, participantId, 'leave');
  }

  connectedCount(room: Room): number {
    let n = 0;
    for (const p of room.participants.values()) if (p.connected) n++;
    return n;
  }

  publicParticipants(room: Room): PublicParticipant[] {
    return [...room.participants.values()]
      .filter((p) => p.connected)
      .map((p) => ({
        id: p.id,
        name: p.name,
        joinedAt: p.joinedAt,
        camera: p.camera,
        microphone: p.microphone,
        screen: p.screen,
        avatar: p.avatar,
      }));
  }

  findParticipant(participantId: string): { room: Room; participant: Participant } | undefined {
    for (const room of this.rooms.values()) {
      const p = room.participants.get(participantId);
      if (p) return { room, participant: p };
    }
    return undefined;
  }

  findBySession(token: string) {
    const ref = this.sessions.get(token);
    if (!ref) return undefined;
    const room = this.rooms.get(ref.roomCode);
    const participant = room?.participants.get(ref.participantId);
    if (!room || !participant) return undefined;
    return { room, participant };
  }

  broadcast(room: Room, msg: ServerMessage, exceptId?: string) {
    for (const p of room.participants.values()) {
      if (exceptId && p.id === exceptId) continue;
      if (p.ws && p.connected && p.ws.readyState === 1) {
        this.send(p.ws, msg);
      }
    }
  }

  sendTo(room: Room, participantId: string, msg: ServerMessage) {
    const p = room.participants.get(participantId);
    if (p?.ws && p.connected && p.ws.readyState === 1) {
      this.send(p.ws, msg);
    }
  }

  touch(room: Room) {
    room.lastActivity = Date.now();
    this.resetInactivity(room);
  }

  private resetInactivity(room: Room) {
    if (room.inactivityTimer) clearTimeout(room.inactivityTimer);
    if (config.roomInactivityMs > 0) {
      room.inactivityTimer = setTimeout(() => {
        this.destroyRoom(room.code, 'inactivity');
      }, config.roomInactivityMs);
    }
  }

  private cancelDestroy(room: Room) {
    if (room.destroyTimer) {
      clearTimeout(room.destroyTimer);
      room.destroyTimer = null;
    }
  }

  private scheduleDestroy(room: Room) {
    this.cancelDestroy(room);
    room.destroyTimer = setTimeout(() => {
      if (this.connectedCount(room) === 0) {
        this.destroyRoom(room.code, 'empty');
      }
    }, room.holdMs);
  }

  destroyRoom(code: string, reason: 'empty' | 'expired' | 'inactivity' | 'max-lifetime' | 'shutdown') {
    const room = this.rooms.get(code);
    if (!room || room.destroyed) return;
    room.destroyed = true;
    this.broadcast(room, { type: 'room-destroyed', reason });
    for (const p of room.participants.values()) {
      if (p.graceTimer) clearTimeout(p.graceTimer);
      this.sessions.delete(p.sessionToken);
      try {
        p.ws?.close(4000, 'room-destroyed');
      } catch {
        /* ignore */
      }
    }
    room.participants.clear();
    if (room.destroyTimer) clearTimeout(room.destroyTimer);
    if (room.lifetimeTimer) clearTimeout(room.lifetimeTimer);
    if (room.inactivityTimer) clearTimeout(room.inactivityTimer);
    this.rooms.delete(code);
    this.onEvent?.({ type: 'destroyed', code, reason });
  }

  lobbyInstances(slug: string): Room[] {
    return [...this.rooms.values()]
      .filter((r) => !r.destroyed && r.lobbySlug === slug)
      .sort((a, b) => (a.lobbyIndex ?? 1) - (b.lobbyIndex ?? 1));
  }

  lobbySnapshot() {
    return LOBBIES.map((theme) => {
      const instances = this.lobbyInstances(theme.slug).map((r) => ({
        index: r.lobbyIndex ?? 1,
        occupants: this.connectedCount(r),
        max: r.maxParticipants,
        title: lobbyDisplayName(theme.name, r.lobbyIndex ?? 1),
      }));
      const open = instances.find((i) => i.occupants < i.max);
      return {
        ...theme,
        instances,
        occupants: instances.reduce((n, i) => n + i.occupants, 0),
        openIndex: open?.index ?? (instances.length ? instances[instances.length - 1]!.index + 1 : 1),
      };
    });
  }

  joinLobby(opts: {
    slug: string;
    index?: number;
    name: string;
    ws: WebSocket;
    sessionToken?: string;
    plan?: 'free' | 'plus' | 'pro';
    maxFileBytes?: number;
    avatar?: string;
  }): { room: Room; participant: Participant; created: boolean; splitFrom?: Room } {
    const theme = lobbyBySlug(opts.slug);
    if (!theme) throw Object.assign(new Error('invalid-room-code'), { code: 'invalid-room-code' });

    if (opts.sessionToken) {
      const existing = this.sessions.get(opts.sessionToken);
      if (existing) {
        const room = this.rooms.get(existing.roomCode);
        const p = room?.participants.get(existing.participantId);
        if (room && p && !room.destroyed) {
          this.attachSocket(room, p, opts.ws);
          if (opts.avatar) p.avatar = opts.avatar;
          return { room, participant: p, created: false };
        }
      }
    }

    const instances = this.lobbyInstances(theme.slug);
    let splitFrom: Room | undefined;
    let target: Room | undefined;
    let created = false;

    if (opts.index && opts.index > 0) {
      target = instances.find((r) => r.lobbyIndex === opts.index);
    }
    if (!target) {
      target = instances.find((r) => r.participants.size < r.maxParticipants);
    }
    if (!target) {
      const nextIndex = instances.length ? Math.max(...instances.map((r) => r.lobbyIndex ?? 1)) + 1 : 1;
      target = this.createRoom(this.generateUniqueCode(), {
        maxParticipants: theme.maxUsers,
        holdMs: 60_000,
        maxLifetimeMs: 12 * 60 * 60 * 1000,
        plan: 'free',
        kind: 'lobby',
        title: lobbyDisplayName(theme.name, nextIndex),
        lobbySlug: theme.slug,
        lobbyIndex: nextIndex,
      });
      created = true;
      if (nextIndex > 1) {
        splitFrom = instances.find((r) => r.lobbyIndex === nextIndex - 1);
      }
    }

    if (target.participants.size >= target.maxParticipants) {
      throw Object.assign(new Error('room-full'), { code: 'room-full' });
    }

    const participant = this.addParticipant(target, opts.name, opts.ws, {
      plan: opts.plan,
      maxFileBytes: opts.maxFileBytes,
      avatar: opts.avatar,
    });
    this.touch(target);
    return { room: target, participant, created, splitFrom };
  }

  offerSplit(from: Room, title: string, lobby: string, index: number) {
    const connected = [...from.participants.values()].filter((p) => p.connected && p.ws);
    const n = Math.min(3, Math.max(1, Math.floor(connected.length / 2)));
    const picks = shuffle(connected).slice(0, n);
    for (const p of picks) {
      if (p.ws) {
        this.send(p.ws, {
          type: 'split-offer',
          lobby,
          index,
          title,
          reason: `${from.title ?? 'This lounge'} is getting busy. ${title} just opened — hop over or stay.`,
        });
      }
    }
  }

  shutdown() {
    for (const code of [...this.rooms.keys()]) {
      this.destroyRoom(code, 'shutdown');
    }
  }

  allowMessage(p: Participant): boolean {
    const now = Date.now();
    if (now - p.messageWindowStart > config.messageRateWindowMs) {
      p.messageWindowStart = now;
      p.messageCount = 0;
    }
    p.messageCount += 1;
    return p.messageCount <= config.messageRateMax;
  }
}

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export const emptyFileStoreNote =
  'CipherChat does not persist files. Relayed chunks exist only in memory during transfer.';
