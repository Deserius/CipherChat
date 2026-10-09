/** Session-only avatar presets. Nothing is stored after the room dies. */

export const AVATAR_PRESETS = [
  { id: 'bolt', label: 'Bolt', glyph: '⚡', from: '#00e5ff', to: '#7c5cff' },
  { id: 'ghost', label: 'Ghost', glyph: '👻', from: '#7c5cff', to: '#9b8cff' },
  { id: 'fox', label: 'Fox', glyph: '🦊', from: '#ff8a4c', to: '#ff4d6d' },
  { id: 'owl', label: 'Owl', glyph: '🦉', from: '#2ee6a6', to: '#00b894' },
  { id: 'cat', label: 'Cat', glyph: '🐱', from: '#ffc857', to: '#ff8a4c' },
  { id: 'rocket', label: 'Rocket', glyph: '🚀', from: '#00e5ff', to: '#2ee6a6' },
  { id: 'moon', label: 'Moon', glyph: '🌙', from: '#7c5cff', to: '#1b2a4a' },
  { id: 'fire', label: 'Ember', glyph: '🔥', from: '#ff4d6d', to: '#ffc857' },
  { id: 'wave', label: 'Wave', glyph: '🌊', from: '#00b8d4', to: '#005f73' },
  { id: 'star', label: 'Star', glyph: '⭐', from: '#ffc857', to: '#7c5cff' },
  { id: 'mask', label: 'Mask', glyph: '🎭', from: '#7c5cff', to: '#00e5ff' },
  { id: 'lock', label: 'Lock', glyph: '🔒', from: '#2ee6a6', to: '#00e5ff' },
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]['id'];

export const AVATAR_PRESET_IDS = new Set<string>(AVATAR_PRESETS.map((a) => a.id));

export const MAX_AVATAR_CHARS = 12_000;

export function isPresetAvatar(id: string): id is AvatarPresetId {
  return AVATAR_PRESET_IDS.has(id);
}

export function avatarPreset(id?: string) {
  if (!id) return undefined;
  return AVATAR_PRESETS.find((a) => a.id === id);
}

/** Accept a preset id or a tiny in-memory image data URL. Reject everything else. */
export function sanitizeAvatar(raw: unknown): string | undefined {
  if (raw == null || raw === '') return undefined;
  if (typeof raw !== 'string') return undefined;
  if (raw.length > MAX_AVATAR_CHARS) return undefined;
  if (isPresetAvatar(raw)) return raw;
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(raw) && raw.length <= MAX_AVATAR_CHARS) {
    return raw;
  }
  return undefined;
}

export const PARTY_BACKGROUNDS = [
  { id: 'void', label: 'Void', css: 'transparent' },
  { id: 'aurora', label: 'Aurora', css: 'radial-gradient(1200px 600px at 10% 0%, rgba(0,229,255,.22), transparent 50%), radial-gradient(900px 500px at 100% 20%, rgba(124,92,255,.28), transparent 55%)' },
  { id: 'ember', label: 'Ember', css: 'radial-gradient(900px 500px at 80% -10%, rgba(255,77,109,.22), transparent 50%), radial-gradient(700px 400px at 0% 100%, rgba(255,200,87,.14), transparent 50%)' },
  { id: 'ocean', label: 'Ocean', css: 'radial-gradient(1000px 600px at 50% 0%, rgba(0,184,212,.25), transparent 55%), radial-gradient(800px 500px at 0% 80%, rgba(46,230,166,.12), transparent 50%)' },
  { id: 'forest', label: 'Forest', css: 'radial-gradient(900px 500px at 20% 0%, rgba(46,230,166,.2), transparent 50%), radial-gradient(700px 500px at 100% 100%, rgba(11,40,24,.6), transparent 50%)' },
  { id: 'neon', label: 'Neon grid', css: 'linear-gradient(180deg, rgba(0,229,255,.08), transparent 40%), repeating-linear-gradient(0deg, transparent, transparent 47px, rgba(0,229,255,.07) 48px), repeating-linear-gradient(90deg, transparent, transparent 47px, rgba(0,229,255,.07) 48px)' },
] as const;

export const PARTY_FONTS = [
  { id: 'sans', label: 'Sans', css: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif" },
  { id: 'mono', label: 'Mono', css: "'IBM Plex Mono', ui-monospace, monospace" },
  { id: 'serif', label: 'Serif', css: "ui-serif, Georgia, Cambria, 'Times New Roman', serif" },
] as const;

export interface RoomTheme {
  title?: string;
  background?: string;
  font?: 'sans' | 'mono' | 'serif';
  accent?: string;
}

const TITLE_MAX = 40;
const ACCENT_RE = /^#[0-9a-fA-F]{6}$/;

export function sanitizeTheme(raw: {
  title?: unknown;
  background?: unknown;
  font?: unknown;
  accent?: unknown;
}): RoomTheme {
  const theme: RoomTheme = {};
  if (typeof raw.title === 'string') {
    const t = raw.title.replace(/[\u0000-\u001F]/g, '').trim().slice(0, TITLE_MAX);
    if (t) theme.title = t;
  }
  if (typeof raw.background === 'string') {
    const bg = raw.background.trim();
    if (PARTY_BACKGROUNDS.some((b) => b.id === bg)) theme.background = bg;
  }
  if (raw.font === 'sans' || raw.font === 'mono' || raw.font === 'serif') theme.font = raw.font;
  if (typeof raw.accent === 'string' && ACCENT_RE.test(raw.accent)) theme.accent = raw.accent;
  return theme;
}
