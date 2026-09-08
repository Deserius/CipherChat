export type PermFlag = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface MediaGrant {
  stream: MediaStream | null;
  audio: boolean;
  video: boolean;
  error?: string;
}

async function query(name: string): Promise<PermFlag> {
  try {
    const n = navigator.permissions;
    if (!n?.query) return 'unknown';
    const r = await n.query({ name: name as PermissionName });
    if (r.state === 'granted' || r.state === 'denied' || r.state === 'prompt') return r.state;
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function permissionSnapshot() {
  const [camera, microphone, notifications] = await Promise.all([
    query('camera'),
    query('microphone'),
    query('notifications'),
  ]);
  return { camera, microphone, notifications };
}

export async function requestAv(want: { audio: boolean; video: boolean }): Promise<MediaGrant> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { stream: null, audio: false, video: false, error: 'This browser does not support camera or microphone access.' };
  }
  const constraints: MediaStreamConstraints = {
    audio: want.audio
      ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      : false,
    video: want.video
      ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      : false,
  };
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return {
      stream,
      audio: stream.getAudioTracks().some((t) => t.readyState === 'live'),
      video: stream.getVideoTracks().some((t) => t.readyState === 'live'),
    };
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (want.audio && want.video) {
      const audioOnly = await requestAv({ audio: true, video: false });
      if (audioOnly.stream) {
        return { ...audioOnly, error: 'Camera is blocked. Continuing with microphone only.' };
      }
    }
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return {
        stream: null,
        audio: false,
        video: false,
        error: 'Permission was denied. You can still join for chat, or allow access in the browser address bar.',
      };
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return { stream: null, audio: false, video: false, error: 'No camera or microphone was found on this device.' };
    }
    if (name === 'NotReadableError' || name === 'AbortError') {
      return {
        stream: null,
        audio: false,
        video: false,
        error: 'The camera or microphone is already in use by another app.',
      };
    }
    if (name === 'SecurityError') {
      return {
        stream: null,
        audio: false,
        video: false,
        error: 'Media access needs a secure context (HTTPS) or an allowed iframe.',
      };
    }
    return {
      stream: null,
      audio: false,
      video: false,
      error: 'Unable to access camera or microphone.',
    };
  }
}

export async function requestNotifications(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const r = await Notification.requestPermission();
    return r === 'granted';
  } catch {
    return false;
  }
}

export function notifyJoin(name: string, room: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  try {
    new Notification(`${name} joined CipherRoom ${room}`, {
      body: 'Open the tab to continue the conversation.',
      silent: true,
    });
  } catch {
    /* ignore */
  }
}
