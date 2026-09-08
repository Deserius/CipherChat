/**
 * Hard-coded ICE (STUN/TURN) that requires no account.
 *
 * STUN: public servers from Cloudflare, Google, and stunprotocol.org.
 * TURN: Open Relay Project static-auth (the same secret Nextcloud Talk documents).
 *       Credentials are short-lived HMAC-SHA1 (TURN REST / coturn use-auth-secret).
 * Custom TURN_* env vars, if set, are prepended and take priority.
 */
import { createHmac } from 'node:crypto';

const OPEN_RELAY_SECRET = 'openrelayprojectsecret';

function turnRestCredential(secret: string, ttlSec = 6 * 3600) {
  const expiry = Math.floor(Date.now() / 1000) + ttlSec;
  const username = `${expiry}:cipherroom`;
  const credential = createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential };
}

export function defaultIceServers(extra?: {
  stunServers?: string[];
  turnServer?: string;
  turnUsername?: string;
  turnPassword?: string;
  turnsServer?: string;
}): { urls: string | string[]; username?: string; credential?: string }[] {
  const rest = turnRestCredential(OPEN_RELAY_SECRET);
  const servers: { urls: string | string[]; username?: string; credential?: string }[] = [
    {
      urls: [
        'stun:stun.cloudflare.com:3478',
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun.stunprotocol.org:3478',
      ],
    },
    {
      urls: [
        'turn:staticauth.openrelay.metered.ca:80',
        'turn:staticauth.openrelay.metered.ca:443',
        'turn:staticauth.openrelay.metered.ca:443?transport=tcp',
        'turns:staticauth.openrelay.metered.ca:443?transport=tcp',
      ],
      username: rest.username,
      credential: rest.credential,
    },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ];

  if (extra?.stunServers?.length) {
    servers.unshift({ urls: extra.stunServers });
  }
  if (extra?.turnServer && extra.turnUsername && extra.turnPassword) {
    const urls = [extra.turnServer];
    if (extra.turnsServer) urls.push(extra.turnsServer);
    servers.unshift({
      urls,
      username: extra.turnUsername,
      credential: extra.turnPassword,
    });
  }
  return servers;
}
