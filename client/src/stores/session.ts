import { create } from 'zustand';
import type { ErrorCode, PublicConfig, PublicParticipant, RTCIceServerLike } from '@shared/protocol';

export type Phase =
  | 'landing'
  | 'connecting'
  | 'room'
  | 'reconnecting'
  | 'left'
  | 'destroyed'
  | 'error';

export interface ChatLine {
  id: string;
  from: string;
  fromName: string;
  text: string;
  kind: 'text' | 'image' | 'file' | 'emoji' | 'system';
  ts: number;
  self: boolean;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'retracted';
  imageUrl?: string;
  fileName?: string;
  fileUrl?: string;
  mime?: string;
  reactions: Record<string, string[]>;
}

export interface SessionState {
  phase: Phase;
  errorCode?: ErrorCode | 'camera' | 'microphone' | 'generic';
  errorMessage?: string;
  name: string;
  roomCode: string;
  participantId: string;
  sessionToken: string;
  participants: PublicParticipant[];
  messages: ChatLine[];
  typing: Record<string, string>;
  config: PublicConfig | null;
  iceServers: RTCIceServerLike[];
  created: boolean;
  connection: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  cryptoReady: boolean;
  banner: string;
  mediaError?: string;
  destroyedReason?: string;

  set: (p: Partial<SessionState>) => void;
  reset: () => void;
  addMessage: (m: ChatLine) => void;
  patchMessage: (id: string, p: Partial<ChatLine>) => void;
}

const initial: Omit<SessionState, 'set' | 'reset' | 'addMessage' | 'patchMessage'> = {
  phase: 'landing',
  name: '',
  roomCode: '',
  participantId: '',
  sessionToken: '',
  participants: [],
  messages: [],
  typing: {},
  config: null,
  iceServers: [],
  created: false,
  connection: 'idle',
  cryptoReady: false,
  banner: 'Temporary encrypted room — messages disappear when the session ends.',
};

export const useSession = create<SessionState>((set, get) => ({
  ...initial,
  set: (p) => set(p),
  reset: () =>
    set({
      ...initial,
      config: get().config,
    }),
  addMessage: (m) => set({ messages: [...get().messages, m].slice(-500) }),
  patchMessage: (id, p) =>
    set({
      messages: get().messages.map((x) => (x.id === id ? { ...x, ...p } : x)),
    }),
}));
