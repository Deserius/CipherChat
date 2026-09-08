export const APP_NAME = 'CipherRoom';
export const APP_TAGLINE = 'Private communication. No permanent identity.';

export const ROOM_CODE_MIN_DIGITS = 4;
export const ROOM_CODE_MAX_DIGITS = 10;
export const DEFAULT_ROOM_CODE_LENGTH = 6;

export const DISPLAY_NAME_MIN = 1;
export const DISPLAY_NAME_MAX = 32;

export const DEFAULT_MAX_PARTICIPANTS = 12;
export const DEFAULT_MAX_MESSAGE_CHARS = 4000;
export const DEFAULT_MAX_FILE_BYTES = 8 * 1024 * 1024;

export const ALLOWED_FILE_MIME = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'audio/mpeg',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
  'video/mp4',
  'video/webm',
  'application/zip',
] as const;

export const WS_PATH = '/ws';

export const SYSTEM_EVENTS = {
  JOINED: 'joined',
  LEFT: 'left',
  DESTROYED: 'destroyed',
} as const;
