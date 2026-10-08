/**
 * Prefer the best available path:
 *   1. Direct peer-to-peer (host / srflx via public STUN)
 *   2. Relayed TURN (Open Relay, free, no account) when NAT blocks P2P
 *
 * iceTransportPolicy 'all' lets the browser pick the lowest-latency pair.
 * We never force 'relay' — that would skip the better P2P route.
 */
export function rtcConfiguration(iceServers: RTCIceServer[]): RTCConfiguration {
  return {
    iceServers,
    iceTransportPolicy: 'all',
    iceCandidatePoolSize: 8,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };
}

export const FALLBACK_ICE: RTCIceServer[] = [
  {
    urls: [
      'stun:stun.cloudflare.com:3478',
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun4.l.google.com:19302',
    ],
  },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
      'turns:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];
