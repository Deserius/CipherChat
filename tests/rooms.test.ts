import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { RoomManager } from '../server/src/rooms/manager.ts';
import { generateRoomCode } from '../server/src/security/cryptoRandom.ts';
import { parseRoomCode, sanitizeDisplayName } from '../server/src/security/validation.ts';
import { hit } from '../server/src/security/rateLimit.ts';
import { processClientMessage, createSend, type SocketCtx } from '../server/src/realtime/handler.ts';
import { encryptText, decryptText, generateRoomKey, generateIdentity, wrapRoomKey, unwrapRoomKey } from '../client/src/crypto/roomCrypto.ts';

function mockWs() {
  const sent: unknown[] = [];
  const ws = {
    readyState: 1,
    send: (data: string) => sent.push(JSON.parse(data)),
    close: vi.fn(),
  };
  return { ws: ws as unknown as WebSocket, sent };
}

describe('room codes', () => {
  it('generates cryptographically random codes of requested length', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const c = generateRoomCode(6);
      expect(c).toMatch(/^\d{6}$/);
      expect(c[0]).not.toBe('0');
      codes.add(c);
    }
    expect(codes.size).toBeGreaterThan(40);
  });

  it('accepts 4-digit and 10-digit codes', () => {
    expect(parseRoomCode('1234')).toBe('1234');
    expect(parseRoomCode('1234567890')).toBe('1234567890');
  });

  it('rejects invalid room codes', () => {
    expect(() => parseRoomCode('12')).toThrow();
    expect(() => parseRoomCode('abcdefgh')).toThrow();
    expect(() => parseRoomCode('12345678901')).toThrow();
  });
});

describe('validation', () => {
  it('sanitizes display names', () => {
    expect(sanitizeDisplayName('  Alice  ')).toBe('Alice');
    expect(() => sanitizeDisplayName('')).toThrow();
    expect(() => sanitizeDisplayName('x'.repeat(40))).toThrow();
  });
});

describe('rate limiting', () => {
  it('blocks after the configured number of hits', () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(hit(key, 3, 60_000).allowed).toBe(true);
    }
    expect(hit(key, 3, 60_000).allowed).toBe(false);
  });
});

describe('RoomManager', () => {
  let manager: RoomManager;
  const send = createSend();

  beforeEach(() => {
    manager = new RoomManager(send);
  });
  afterEach(() => {
    manager.shutdown();
  });

  it('creates a room and joins a participant', () => {
    const { ws } = mockWs();
    const { room, participant, created } = manager.joinOrCreate({
      name: 'Alice',
      createRandom: true,
      ws,
    });
    expect(created).toBe(true);
    expect(room.code).toMatch(/^\d{4,10}$/);
    expect(participant.name).toBe('Alice');
    expect(manager.stats().rooms).toBe(1);
    expect(manager.stats().participants).toBe(1);
  });

  it('lets a second participant join the same code', () => {
    const a = mockWs();
    const b = mockWs();
    const first = manager.joinOrCreate({ name: 'Alice', roomCode: '482917', ws: a.ws });
    const second = manager.joinOrCreate({ name: 'Bob', roomCode: '482917', ws: b.ws });
    expect(first.room.code).toBe(second.room.code);
    expect(manager.stats().participants).toBe(2);
    expect(first.participant.id).not.toBe(second.participant.id);
  });

  it('supports three participants and message broadcast', () => {
    const a = mockWs();
    const b = mockWs();
    const c = mockWs();
    manager.joinOrCreate({ name: 'Alice', roomCode: '1111', ws: a.ws });
    manager.joinOrCreate({ name: 'Bob', roomCode: '1111', ws: b.ws });
    manager.joinOrCreate({ name: 'Charlie', roomCode: '1111', ws: c.ws });
    const room = manager.getRoom('1111')!;
    manager.broadcast(room, { type: 'system', event: 'info', text: 'hello', ts: 1 });
    expect(a.sent.some((m) => (m as { text?: string }).text === 'hello')).toBe(true);
    expect(b.sent.some((m) => (m as { text?: string }).text === 'hello')).toBe(true);
    expect(c.sent.some((m) => (m as { text?: string }).text === 'hello')).toBe(true);
  });

  it('rejects a join when the room is full', () => {
    const room = manager.createRoom('2222');
    for (let i = 0; i < 12; i++) {
      manager.addParticipant(room, `P${i}`, mockWs().ws);
    }
    expect(() =>
      manager.joinOrCreate({ name: 'overflow', roomCode: '2222', ws: mockWs().ws }),
    ).toThrow(/room-full/);
  });

  it('accepts 4-digit and 10-digit rooms', () => {
    const a = manager.joinOrCreate({ name: 'A', roomCode: '1234', ws: mockWs().ws });
    const b = manager.joinOrCreate({ name: 'B', roomCode: '1234567890', ws: mockWs().ws });
    expect(a.room.code).toBe('1234');
    expect(b.room.code).toBe('1234567890');
  });

  it('destroys a room after the last participant leaves', async () => {
    vi.useFakeTimers();
    const a = mockWs();
    const { room, participant } = manager.joinOrCreate({ name: 'Solo', roomCode: '3333', ws: a.ws });
    manager.removeParticipant(room.code, participant.id, 'leave');
    expect(manager.getRoom('3333')).toBeTruthy();
    vi.advanceTimersByTime(35_000);
    expect(manager.getRoom('3333')).toBeUndefined();
    vi.useRealTimers();
  });

  it('resumes a session token after a brief disconnect', () => {
    const a = mockWs();
    const joined = manager.joinOrCreate({ name: 'Alice', roomCode: '4444', ws: a.ws });
    manager.markDisconnected(joined.participant.id);
    const b = mockWs();
    const resumed = manager.joinOrCreate({
      name: 'Alice',
      roomCode: '4444',
      sessionToken: joined.participant.sessionToken,
      ws: b.ws,
    });
    expect(resumed.participant.id).toBe(joined.participant.id);
  });
});

describe('websocket join protocol', () => {
  it('creates a room through the join handler', () => {
    const send = createSend();
    const manager = new RoomManager(send);
    const { ws, sent } = mockWs();
    const ctx: SocketCtx = { ipHash: 'abc', authed: false };
    processClientMessage(manager, ws, ctx, { type: 'join', name: 'Dana', createRandom: true });
    const joined = sent.find((m) => (m as { type: string }).type === 'joined') as {
      type: string;
      roomCode: string;
      participantId: string;
    };
    expect(joined).toBeTruthy();
    expect(joined.roomCode).toMatch(/^\d{4,10}$/);
    expect(ctx.authed).toBe(true);
    manager.shutdown();
  });

  it('rejects an invalid name', () => {
    const manager = new RoomManager(createSend());
    const { ws, sent } = mockWs();
    const ctx: SocketCtx = { ipHash: 'def', authed: false };
    processClientMessage(manager, ws, ctx, { type: 'join', name: '' });
    expect(sent.some((m) => (m as { code?: string }).code === 'invalid-name')).toBe(true);
    manager.shutdown();
  });
});

describe('client-side encryption', () => {
  it('round-trips AES-GCM text', async () => {
    const key = await generateRoomKey();
    const { ciphertext, iv } = await encryptText(key, 'hello room');
    expect(ciphertext).not.toContain('hello');
    expect(await decryptText(key, ciphertext, iv)).toBe('hello room');
  });

  it('wraps a room key to another identity via ECDH', async () => {
    const alice = await generateIdentity();
    const bob = await generateIdentity();
    const roomKey = await generateRoomKey();
    const wrapped = await wrapRoomKey(roomKey, alice.privateKey, bob.publicKey);
    const recovered = await unwrapRoomKey(wrapped.wrappedKey, wrapped.iv, bob.privateKey, alice.publicKey);
    const msg = await encryptText(roomKey, 'secret');
    expect(await decryptText(recovered, msg.ciphertext, msg.iv)).toBe('secret');
  });
});

describe('end-to-end room lifecycle over WebSocket', () => {
  it('A creates, B and C join, message fans out, everyone leaves, room dies', async () => {
    const send = createSend();
    const manager = new RoomManager(send);
    const wss = new WebSocketServer({ port: 0 });
    const port = (wss.address() as { port: number }).port;

    wss.on('connection', (socket) => {
      const ctx: SocketCtx = { ipHash: 'e2e', authed: false };
      socket.on('message', (data) => {
        processClientMessage(manager, socket, ctx, JSON.parse(String(data)));
      });
      socket.on('close', () => {
        if (ctx.participantId) manager.markDisconnected(ctx.participantId);
      });
    });

    function client(): Promise<{ ws: WebSocket; inbox: unknown[] }> {
      return new Promise((resolve) => {
        const inbox: unknown[] = [];
        const ws = new WebSocket(`ws://127.0.0.1:${port}`);
        ws.on('message', (d) => inbox.push(JSON.parse(String(d))));
        ws.on('open', () => resolve({ ws, inbox }));
      });
    }

    const A = await client();
    A.ws.send(JSON.stringify({ type: 'join', name: 'Alice', createRandom: true }));
    await vi.waitFor(() => {
      expect(A.inbox.some((m) => (m as { type: string }).type === 'joined')).toBe(true);
    });
    const joined = A.inbox.find((m) => (m as { type: string }).type === 'joined') as { roomCode: string };
    const code = joined.roomCode;

    const B = await client();
    B.ws.send(JSON.stringify({ type: 'join', name: 'Bob', roomCode: code }));
    const C = await client();
    C.ws.send(JSON.stringify({ type: 'join', name: 'Charlie', roomCode: code }));
    await vi.waitFor(() => {
      expect(manager.getRoom(code)?.participants.size).toBe(3);
    });

    A.ws.send(
      JSON.stringify({
        type: 'chat',
        ciphertext: 'Y2lwaGVydGV4dA==',
        iv: 'aXZpdml2aXZpdml2',
        kind: 'text',
        clientId: 'msg-aaaa-bbbb-cccc',
      }),
    );
    await vi.waitFor(() => {
      expect(B.inbox.some((m) => (m as { type: string }).type === 'chat')).toBe(true);
      expect(C.inbox.some((m) => (m as { type: string }).type === 'chat')).toBe(true);
    });

    A.ws.close();
    B.ws.close();
    C.ws.close();
    // force immediate removal rather than waiting grace for this test
    for (const p of [...(manager.getRoom(code)?.participants.values() ?? [])]) {
      manager.removeParticipant(code, p.id, 'leave');
    }
    // scheduleDestroy uses grace; invoke destroy directly to assert the pipeline
    manager.destroyRoom(code, 'empty');
    expect(manager.getRoom(code)).toBeUndefined();

    wss.close();
    manager.shutdown();
  });
});
