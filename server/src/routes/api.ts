import { Router } from 'express';
import { config, iceServers, publicConfig } from '../config.ts';
import type { RoomManager } from '../rooms/manager.ts';
import { communicationHub } from '../providers/communication.ts';
import { z } from 'zod';

export function createApi(manager: RoomManager) {
  const api = Router();

  api.get('/health', (_req, res) => {
    const mem = process.memoryUsage();
    const s = manager.stats();
    res.json({
      status: 'ok',
      service: 'cipherroom',
      uptimeSec: Math.round(process.uptime()),
      rooms: s.rooms,
      participants: s.participants,
      connections: s.connections,
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024),
      },
      providers: communicationHub.status(),
      version: '1.0.0',
    });
  });

  api.get('/ready', (_req, res) => {
    res.json({ ready: true });
  });

  api.get('/config', (_req, res) => {
    res.json(publicConfig());
  });

  api.get('/ice', (_req, res) => {
    res.json({ iceServers: iceServers() });
  });

  // Privacy-preserving ops snapshot — no names, no room codes, no messages.
  api.get('/ops', (_req, res) => {
    const s = manager.stats();
    res.json({
      rooms: s.rooms,
      participants: s.participants,
      connections: s.connections,
      uptimeSec: Math.round(process.uptime()),
      node: process.version,
    });
  });

  // Optional SMS invite via Twilio. Body never includes message contents of a room.
  api.post('/invite/sms', async (req, res) => {
    if (!communicationHub.twilio.available) {
      res.status(503).json({ error: 'SMS is not configured on this server.' });
      return;
    }
    const schema = z.object({
      to: z.string().regex(/^\+[1-9]\d{7,14}$/),
      roomCode: z.string().regex(/^\d{4,10}$/),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid phone number or room code.' });
      return;
    }
    const link = `${config.appUrl.replace(/\/$/, '')}/r/${parsed.data.roomCode}`;
    const result = await communicationHub.twilio.sms({
      to: parsed.data.to,
      body: `You're invited to a CipherRoom. Open ${link} — the room is temporary and disappears when everyone leaves.`,
    });
    if ('error' in result) {
      res.status(502).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  return api;
}
