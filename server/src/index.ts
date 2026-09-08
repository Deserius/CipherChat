import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, type WebSocket } from 'ws';
import { config } from './config.ts';
import { RoomManager } from './rooms/manager.ts';
import { createApi } from './routes/api.ts';
import {
  createSend,
  handleUpgradeWelcome,
  processClientMessage,
  type SocketCtx,
} from './realtime/handler.ts';
import { connectionCounter, hit } from './security/rateLimit.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function clientIp(req: http.IncomingMessage): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0 && config.trustProxy) {
    return xf.split(',')[0]!.trim();
  }
  return req.socket.remoteAddress ?? '0.0.0.0';
}

function originAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin / non-browser
  if (!config.isProd) return true;
  if (config.allowFraming) return true;
  try {
    const u = new URL(origin);
    const app = new URL(config.appUrl);
    if (u.host === app.host) return true;
    if (config.extraOrigins.includes(origin)) return true;
    // Render / preview hosts
    if (u.hostname.endsWith('.onrender.com')) return true;
    if (u.hostname.endsWith('.e2b.app')) return true;
    return false;
  } catch {
    return false;
  }
}

export function createApp(manager: RoomManager) {
  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1);

  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'blob:', 'data:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'", 'ws:', 'wss:', 'stun:', 'stuns:', 'turn:', 'turns:'],
          mediaSrc: ["'self'", 'blob:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: config.allowFraming ? ['*'] : ["'self'"],
          upgradeInsecureRequests: config.isProd ? [] : null,
        },
      },
      frameguard: config.allowFraming ? false : { action: 'deny' },
      hsts: config.isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: config.allowFraming ? false : { policy: 'same-origin-allow-popups' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: (origin, cb) => {
        if (originAllowed(origin)) cb(null, true);
        else cb(new Error('Origin not allowed'));
      },
      credentials: false,
    }),
  );

  app.use((req, res, next) => {
    const who = config.allowFraming ? '*' : 'self';
    res.setHeader(
      'Permissions-Policy',
      `camera=(${who}), microphone=(${who}), display-capture=(${who}), fullscreen=(${who}), autoplay=(${who}), clipboard-write=(self)`,
    );
    next();
  });

  app.use(express.json({ limit: '32kb' }));

  const httpLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxHttp,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait.' },
  });
  app.use('/api', httpLimiter);
  app.use('/api', createApi(manager));

  // Never cache HTML; static assets hashed by Vite can be cached.
  app.use((req, res, next) => {
    if (req.path === '/' || req.path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });

  app.use(
    express.static(clientDist, {
      maxAge: config.isProd ? '7d' : 0,
      setHeaders(res, filePath) {
        if (filePath.endsWith('sw.js') || filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-store');
        }
        if (filePath.endsWith('manifest.webmanifest') || filePath.endsWith('manifest.json')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) {
        res.status(503).type('html').send(
          '<!doctype html><meta charset="utf-8"><title>CipherRoom</title><body style="background:#05070b;color:#e8eef7;font-family:sans-serif;padding:2rem"><h1>Client bundle missing</h1><p>Run <code>npm run build</code> or <code>npm run dev</code>.</p>',
        );
      }
    });
  });

  return app;
}

export function createServer() {
  const send = createSend();
  const manager = new RoomManager(send);
  const app = createApp(manager);
  const server = http.createServer(app);

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: config.maxWsPayloadBytes,
    perMessageDeflate: false,
  });

  const conns = connectionCounter();

  server.on('upgrade', (req, socket, head) => {
    const url = req.url ?? '';
    if (!url.startsWith('/ws')) {
      socket.destroy();
      return;
    }
    const origin = req.headers.origin;
    if (config.isProd && !originAllowed(typeof origin === 'string' ? origin : undefined)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const ip = clientIp(req);
    const ipHash = hashIp(ip);
    if (conns.get(ipHash) >= config.wsMaxConnectionsPerIp) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const burst = hit(`ws:${ipHash}`, 60, 60_000, 15_000);
    if (!burst.allowed) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, ipHash);
    });
  });

  wss.on('connection', (ws: WebSocket, _req: http.IncomingMessage, ipHash: string) => {
    conns.inc(ipHash);
    const ctx: SocketCtx = { ipHash, authed: false };
    handleUpgradeWelcome(ws);

    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      const text = typeof data === 'string' ? data : data.toString('utf8');
      if (text.length > config.maxWsPayloadBytes) {
        ws.close(1009, 'too large');
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return;
      }
      processClientMessage(manager, ws, ctx, parsed);
    });

    ws.on('close', () => {
      conns.dec(ipHash);
      if (ctx.participantId) manager.markDisconnected(ctx.participantId);
    });

    ws.on('error', () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    });
  });

  const pingTimer = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === 1) {
        try {
          ws.ping();
        } catch {
          /* ignore */
        }
      }
    });
  }, 25_000);
  pingTimer.unref();

  const shutdown = () => {
    manager.shutdown();
    wss.close();
    server.close();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { server, app, manager, wss };
}


