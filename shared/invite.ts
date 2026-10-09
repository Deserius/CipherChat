/** Parse a CipherChat invite URL, lounge path, or raw room code. */

export function parseCipherInvite(raw: string): { room?: string; lobby?: string } | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{4,10}$/.test(t)) return { room: t };

  try {
    const u = new URL(t, 'https://cipherchat.local');
    const roomQ = u.searchParams.get('room');
    if (roomQ && /^\d{4,10}$/.test(roomQ.replace(/\D/g, ''))) {
      return { room: roomQ.replace(/\D/g, '').slice(0, 10) };
    }
    const lobbyQ = u.searchParams.get('lobby');
    if (lobbyQ && /^[a-z0-9-]{2,40}$/i.test(lobbyQ)) {
      return { lobby: lobbyQ.toLowerCase() };
    }
    const parts = u.pathname.split('/').filter(Boolean);
    const head = (parts[0] || '').toLowerCase();
    if (head === 'r' || head === 'room' || head === 'join') {
      const code = (parts[1] || '').replace(/\D/g, '').slice(0, 10);
      if (/^\d{4,10}$/.test(code)) return { room: code };
    }
    if (head === 'c' && parts[1] && /^[a-z0-9-]{2,40}$/i.test(parts[1])) {
      return { lobby: parts[1].toLowerCase() };
    }
  } catch {
    /* not a URL */
  }
  return null;
}
