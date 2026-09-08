import type { WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '../../../shared/protocol.ts';
import { ALLOWED_FILE_MIME } from '../../../shared/constants.ts';
import { config, iceServers, publicConfig } from '../config.ts';
import { RoomManager } from '../rooms/manager.ts';
import { parseRoomCode, sanitizeDisplayName, isAllowedEmoji, isSafeClientId } from '../security/validation.ts';
import { hit } from '../security/rateLimit.ts';

const MAX_SIGNAL_BYTES = 32_768;
const MAX_CIPHERTEXT_BYTES = 24_000;
const MAX_CHUNKS = 64;
const MAX_PUBLIC_KEY_B64 = 1024;

export interface SocketCtx {
  ipHash: string;
  participantId?: string;
  roomCode?: string;
  authed: boolean;
}

function safeSend(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState !== 1) return;
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    /* ignore broken pipe */
  }
}

export function createSend() {
  return safeSend;
}

export function handleUpgradeWelcome(ws: WebSocket) {
  safeSend(ws, {
    type: 'welcome',
    iceServers: iceServers(),
    config: publicConfig(),
  });
}

export function processClientMessage(
  manager: RoomManager,
  ws: WebSocket,
  ctx: SocketCtx,
  raw: unknown,
): void {
  if (!raw || typeof raw !== 'object') {
    safeSend(ws, { type: 'error', code: 'invalid-message', message: 'Malformed message.' });
    return;
  }
  const msg = raw as ClientMessage;
  if (!msg || typeof (msg as { type?: unknown }).type !== 'string') {
    safeSend(ws, { type: 'error', code: 'invalid-message', message: 'Malformed message.' });
    return;
  }

  try {
    switch (msg.type) {
      case 'join':
        return onJoin(manager, ws, ctx, msg);
      case 'leave':
        return onLeave(manager, ctx);
      case 'chat':
        return onChat(manager, ctx, msg);
      case 'typing':
        return onTyping(manager, ctx, msg);
      case 'signal':
        return onSignal(manager, ctx, msg);
      case 'key-announce':
        return onKeyAnnounce(manager, ctx, msg);
      case 'key-wrap':
        return onKeyWrap(manager, ctx, msg);
      case 'file-meta':
        return onFileMeta(manager, ctx, msg);
      case 'file-chunk':
        return onFileChunk(manager, ctx, msg);
      case 'reaction':
        return onReaction(manager, ctx, msg);
      case 'retract':
        return onRetract(manager, ctx, msg);
      case 'ping':
        safeSend(ws, { type: 'pong', ts: msg.ts });
        return;
      case 'heartbeat':
        return onHeartbeat(manager, ctx);
      case 'media-state':
        return onMediaState(manager, ctx, msg);
      default:
        safeSend(ws, { type: 'error', code: 'invalid-message', message: 'Unknown message type.' });
    }
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'invalid-name') {
      safeSend(ws, { type: 'error', code: 'invalid-name', message: 'Please enter a valid display name.' });
      return;
    }
    if (code === 'invalid-room-code') {
      safeSend(ws, {
        type: 'error',
        code: 'invalid-room-code',
        message: 'Room codes must be 4 to 10 digits.',
      });
      return;
    }
    if (code === 'room-full') {
      safeSend(ws, { type: 'error', code: 'room-full', message: 'This room is full.' });
      return;
    }
    if (code === 'room-expired') {
      safeSend(ws, { type: 'error', code: 'room-expired', message: 'This room has expired.' });
      return;
    }
    safeSend(ws, { type: 'error', code: 'server-error', message: 'Unable to complete that request.' });
  }
}

function requireRoom(manager: RoomManager, ctx: SocketCtx) {
  if (!ctx.authed || !ctx.participantId || !ctx.roomCode) {
    throw Object.assign(new Error('unauthorized'), { code: 'unauthorized' });
  }
  const room = manager.getRoom(ctx.roomCode);
  const p = room?.participants.get(ctx.participantId);
  if (!room || !p) throw Object.assign(new Error('unauthorized'), { code: 'unauthorized' });
  return { room, p };
}

function onJoin(
  manager: RoomManager,
  ws: WebSocket,
  ctx: SocketCtx,
  msg: Extract<ClientMessage, { type: 'join' }>,
) {
  const joinHit = hit(`join:${ctx.ipHash}`, config.rateLimitMaxJoin, config.rateLimitWindowMs, 30_000);
  if (!joinHit.allowed) {
    safeSend(ws, {
      type: 'error',
      code: 'rate-limited',
      message: 'Too many join attempts. Please wait.',
    });
    return;
  }

  const name = sanitizeDisplayName(msg.name);
  let roomCode: string | undefined;
  if (msg.roomCode) roomCode = parseRoomCode(msg.roomCode);

  if (msg.createRandom) {
    const createHit = hit(
      `create:${ctx.ipHash}`,
      config.rateLimitMaxCreate,
      config.rateLimitWindowMs,
      60_000,
    );
    if (!createHit.allowed) {
      safeSend(ws, {
        type: 'error',
        code: 'rate-limited',
        message: 'Too many rooms created. Please wait.',
      });
      return;
    }
  }

  const { room, participant, created } = manager.joinOrCreate({
    name,
    roomCode,
    createRandom: Boolean(msg.createRandom) && !roomCode,
    sessionToken: typeof msg.sessionToken === 'string' ? msg.sessionToken : undefined,
    ws,
  });

  ctx.authed = true;
  ctx.participantId = participant.id;
  ctx.roomCode = room.code;

  safeSend(ws, {
    type: 'joined',
    roomCode: room.code,
    participantId: participant.id,
    sessionToken: participant.sessionToken,
    participants: manager.publicParticipants(room),
    created,
    iceServers: iceServers(),
  });

  manager.broadcast(
    room,
    {
      type: 'participant-joined',
      participant: {
        id: participant.id,
        name: participant.name,
        joinedAt: participant.joinedAt,
        camera: false,
        microphone: false,
        screen: false,
      },
    },
    participant.id,
  );
  manager.broadcast(
    room,
    {
      type: 'system',
      event: 'joined',
      text: `${participant.name} joined the room`,
      ts: Date.now(),
    },
    participant.id,
  );
}

function onLeave(manager: RoomManager, ctx: SocketCtx) {
  if (ctx.participantId) manager.leave(ctx.participantId);
  ctx.authed = false;
  ctx.participantId = undefined;
  ctx.roomCode = undefined;
}

function onChat(
  manager: RoomManager,
  ctx: SocketCtx,
  msg: Extract<ClientMessage, { type: 'chat' }>,
) {
  const { room, p } = requireRoom(manager, ctx);
  if (!manager.allowMessage(p)) {
    if (p.ws) {
      safeSend(p.ws, { type: 'rate-limited', retryAfterMs: config.messageRateWindowMs });
    }
    return;
  }
  if (typeof msg.ciphertext !== 'string' || typeof msg.iv !== 'string') {
    throw Object.assign(new Error('invalid-message'), { code: 'invalid-message' });
  }
  if (msg.ciphertext.length > MAX_CIPHERTEXT_BYTES || msg.iv.length > 64) {
    throw Object.assign(new Error('payload-too-large'), { code: 'payload-too-large' });
  }
  if (!isSafeClientId(msg.clientId)) {
    throw Object.assign(new Error('invalid-message'), { code: 'invalid-message' });
  }
  const kind = msg.kind === 'image' || msg.kind === 'file' || msg.kind === 'emoji' ? msg.kind : 'text';
  manager.touch(room);
  manager.broadcast(
    room,
    {
      type: 'chat',
      from: p.id,
      fromName: p.name,
      ciphertext: msg.ciphertext,
      iv: msg.iv,
      kind,
      clientId: msg.clientId,
      ts: Date.now(),
    },
    p.id,
  );
}

function onTyping(
  manager: RoomManager,
  ctx: SocketCtx,
  msg: Extract<ClientMessage, { type: 'typing' }>,
) {
  const { room, p } = requireRoom(manager, ctx);
  manager.broadcast(
    room,
    { type: 'typing', from: p.id, fromName: p.name, isTyping: Boolean(msg.isTyping) },
    p.id,
  );
}

function onSignal(
  manager: RoomManager,
  ctx: SocketCtx,
  msg: Extract<ClientMessage, { type: 'signal' }>,
) {
  const { room, p } = requireRoom(manager, ctx);
  if (typeof msg.to !== 'string' || !room.participants.has(msg.to)) return;
  const encoded = JSON.stringify(msg.data ?? null);
  if (encoded.length > MAX_SIGNAL_BYTES) return;
  manager.sendTo(room, msg.to, { type: 'signal', from: p.id, data: msg.data });
}

function onKeyAnnounce(
  manager: RoomManager,
  ctx: SocketCtx,
  msg: Extract<ClientMessage, { type: 'key-announce' }>,
) {
  const { room, p } = requireRoom(manager, ctx);
  if (typeof msg.publicKey !== 'string' || msg.publicKey.length > MAX_PUBLIC_KEY_B64) return;
  manager.broadcast(room, { type: 'key-announce', from: p.id, publicKey: msg.publicKey }, p.id);
}

function onKeyWrap(
  manager: RoomManager,
  ctx: SocketCtx,
  msg: Extract<ClientMessage, { type: 'key-wrap' }>,
) {
  const { room, p } = requireRoom(manager, ctx);
  if (typeof msg.to !== 'string' || !room.participants.has(msg.to)) return;
  if (typeof msg.wrappedKey !== 'string' || msg.wrappedKey.length > 4096) return;
  if (typeof msg.iv !== 'string' || msg.iv.length > 64) return;
  if (typeof msg.senderPublicKey !== 'string' || msg.senderPublicKey.length > MAX_PUBLIC_KEY_B64) return;
  manager.sendTo(room, msg.to, {
    type: 'key-wrap',
    from: p.id,
    wrappedKey: msg.wrappedKey,
    iv: msg.iv,
    senderPublicKey: msg.senderPublicKey,
  });
}

function onFileMeta(
  manager: RoomManager,
  ctx: SocketCtx,
  msg: Extract<ClientMessage, { type: 'file-meta' }>,
) {
  const { room, p } = requireRoom(manager, ctx);
  if (!manager.allowMessage(p)) return;
  if (typeof msg.size !== 'number' || msg.size <= 0 || msg.size > config.maxFileBytes) {
    if (p.ws) {
      safeSend(p.ws, {
        type: 'error',
        code: 'payload-too-large',
        message: 'File exceeds the maximum size.',
      });
    }
    return;
  }
  if (typeof msg.mime !== 'string' || !(ALLOWED_FILE_MIME as readonly string[]).includes(msg.mime)) {
    if (p.ws) {
      safeSend(p.ws, {
        type: 'error',
        code: 'unsupported-file',
        message: 'That file type is not allowed.',
      });
    }
    return;
  }
  if (typeof msg.totalChunks !== 'number' || msg.totalChunks < 1 || msg.totalChunks > MAX_CHUNKS) return;
  if (typeof msg.name !== 'string' || msg.name.length > 180) return;
  const safeName = msg.name.replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 180);
  manager.touch(room);
  manager.broadcast(
    room,
    {
      type: 'file-meta',
      from: p.id,
      fromName: p.name,
      fileId: String(msg.fileId).slice(0, 80),
      name: safeName,
      mime: msg.mime,
      size: msg.size,
      iv: String(msg.iv).slice(0, 64),
      totalChunks: msg.totalChunks,
      kind: msg.kind === 'image' ? 'image' : 'file',
      ts: Date.now(),
    },
    p.id,
  );
}

function onFileChunk(
  manager: RoomManager,
  ctx: SocketCtx,
  msg: Extract<ClientMessage, { type: 'file-chunk' }>,
) {
  const { room, p } = requireRoom(manager, ctx);
  if (typeof msg.data !== 'string') return;
  // ~64KB decoded per chunk budget
  if (msg.data.length > 96_000) return;
  if (typeof msg.index !== 'number' || typeof msg.total !== 'number') return;
  if (msg.total > MAX_CHUNKS || msg.index < 0 || msg.index >= msg.total) return;
  manager.broadcast(
    room,
    {
      type: 'file-chunk',
      from: p.id,
      fileId: String(msg.fileId).slice(0, 80),
      index: msg.index,
      total: msg.total,
      data: msg.data,
    },
    p.id,
  );
}

function onReaction(
  manager: RoomManager,
  ctx: SocketCtx,
  msg: Extract<ClientMessage, { type: 'reaction' }>,
) {
  const { room, p } = requireRoom(manager, ctx);
  if (!isSafeClientId(msg.messageId) && typeof msg.messageId !== 'string') return;
  if (typeof msg.messageId !== 'string' || msg.messageId.length > 80) return;
  if (!isAllowedEmoji(msg.emoji)) return;
  manager.broadcast(
    room,
    { type: 'reaction', from: p.id, fromName: p.name, messageId: msg.messageId, emoji: msg.emoji },
    p.id,
  );
}

function onRetract(
  manager: RoomManager,
  ctx: SocketCtx,
  msg: Extract<ClientMessage, { type: 'retract' }>,
) {
  const { room, p } = requireRoom(manager, ctx);
  if (typeof msg.messageId !== 'string' || msg.messageId.length > 80) return;
  manager.broadcast(room, { type: 'retract', from: p.id, messageId: msg.messageId }, p.id);
}

function onHeartbeat(manager: RoomManager, ctx: SocketCtx) {
  if (!ctx.participantId) return;
  const found = manager.findParticipant(ctx.participantId);
  if (found) found.participant.lastSeen = Date.now();
}

function onMediaState(
  manager: RoomManager,
  ctx: SocketCtx,
  msg: Extract<ClientMessage, { type: 'media-state' }>,
) {
  const { room, p } = requireRoom(manager, ctx);
  p.camera = Boolean(msg.camera);
  p.microphone = Boolean(msg.microphone);
  p.screen = Boolean(msg.screen);
  manager.broadcast(
    room,
    {
      type: 'media-state',
      from: p.id,
      camera: p.camera,
      microphone: p.microphone,
      screen: p.screen,
    },
    p.id,
  );
}

export { safeSend };
