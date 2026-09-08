import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createServer } from '../server/src/index.ts';

process.env.CIPHERROOM_NO_LISTEN = '1';

const { app, server, manager } = createServer();

afterAll(async () => {
  manager.shutdown();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('HTTP API', () => {
  it('serves a privacy-preserving health document', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.rooms).toBeTypeOf('number');
    expect(JSON.stringify(res.body)).not.toMatch(/Alice|ciphertext|sessionToken/);
  });

  it('exposes public config without secrets', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.maxParticipants).toBeGreaterThan(1);
    expect(res.body).not.toHaveProperty('turnPassword');
    expect(res.body).not.toHaveProperty('twilioAuthToken');
  });

  it('returns ICE servers', async () => {
    const res = await request(app).get('/api/ice');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.iceServers)).toBe(true);
  });

  it('sets security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeTruthy();
    expect(res.headers['referrer-policy']).toMatch(/no-referrer/);
  });

  it('rejects oversized JSON', async () => {
    const res = await request(app)
      .post('/api/invite/sms')
      .set('Content-Type', 'application/json')
      .send({ to: 'not-a-phone', roomCode: '12' });
    expect([400, 503]).toContain(res.status);
  });
});
