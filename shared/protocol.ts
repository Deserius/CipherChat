/** Wire protocol shared by client and server. Ciphertexts are opaque to the server. */

export type ClientMessage =
  | JoinMessage
  | LeaveMessage
  | ChatMessage
  | TypingMessage
  | SignalMessage
  | KeyAnnounceMessage
  | KeyWrapMessage
  | FileMetaMessage
  | FileChunkMessage
  | ReactionMessage
  | RetractMessage
  | PingMessage
  | MediaStateMessage
  | HeartbeatMessage;

export type ServerMessage =
  | WelcomeMessage
  | JoinedMessage
  | ParticipantJoinedMessage
  | ParticipantLeftMessage
  | ChatRelayMessage
  | TypingRelayMessage
  | SignalRelayMessage
  | KeyAnnounceRelayMessage
  | KeyWrapRelayMessage
  | FileMetaRelayMessage
  | FileChunkRelayMessage
  | ReactionRelayMessage
  | RetractRelayMessage
  | PongMessage
  | ErrorMessage
  | SystemMessage
  | RoomDestroyedMessage
  | MediaStateRelayMessage
  | RateLimitedMessage;

export interface JoinMessage {
  type: 'join';
  name: string;
  roomCode?: string;
  createRandom?: boolean;
  sessionToken?: string;
}

export interface LeaveMessage {
  type: 'leave';
}

export interface ChatMessage {
  type: 'chat';
  /** AES-GCM ciphertext, base64 */
  ciphertext: string;
  /** 12-byte IV, base64 */
  iv: string;
  /** Optional content hint: text | image | file | emoji  (not sensitive) */
  kind?: 'text' | 'image' | 'file' | 'emoji';
  clientId: string;
}

export interface TypingMessage {
  type: 'typing';
  isTyping: boolean;
}

export interface SignalMessage {
  type: 'signal';
  to: string;
  data: unknown;
}

export interface KeyAnnounceMessage {
  type: 'key-announce';
  /** SPKI public key, base64 */
  publicKey: string;
}

export interface KeyWrapMessage {
  type: 'key-wrap';
  to: string;
  /** Room key encrypted to recipient, base64 */
  wrappedKey: string;
  iv: string;
  /** Sender's SPKI public key so recipient can derive the shared secret */
  senderPublicKey: string;
}

export interface FileMetaMessage {
  type: 'file-meta';
  fileId: string;
  name: string;
  mime: string;
  size: number;
  iv: string;
  totalChunks: number;
  kind: 'image' | 'file';
}

export interface FileChunkMessage {
  type: 'file-chunk';
  fileId: string;
  index: number;
  total: number;
  /** Encrypted chunk, base64 */
  data: string;
}

export interface ReactionMessage {
  type: 'reaction';
  messageId: string;
  emoji: string;
}

export interface RetractMessage {
  type: 'retract';
  messageId: string;
}

export interface PingMessage {
  type: 'ping';
  ts: number;
}

export interface HeartbeatMessage {
  type: 'heartbeat';
}

export interface MediaStateMessage {
  type: 'media-state';
  camera: boolean;
  microphone: boolean;
  screen: boolean;
}

export interface WelcomeMessage {
  type: 'welcome';
  iceServers: RTCIceServerLike[];
  config: PublicConfig;
}

export interface JoinedMessage {
  type: 'joined';
  roomCode: string;
  participantId: string;
  sessionToken: string;
  participants: PublicParticipant[];
  created: boolean;
  iceServers: RTCIceServerLike[];
}

export interface ParticipantJoinedMessage {
  type: 'participant-joined';
  participant: PublicParticipant;
}

export interface ParticipantLeftMessage {
  type: 'participant-left';
  participantId: string;
  name: string;
}

export interface ChatRelayMessage {
  type: 'chat';
  from: string;
  fromName: string;
  ciphertext: string;
  iv: string;
  kind?: 'text' | 'image' | 'file' | 'emoji';
  clientId: string;
  ts: number;
}

export interface TypingRelayMessage {
  type: 'typing';
  from: string;
  fromName: string;
  isTyping: boolean;
}

export interface SignalRelayMessage {
  type: 'signal';
  from: string;
  data: unknown;
}

export interface KeyAnnounceRelayMessage {
  type: 'key-announce';
  from: string;
  publicKey: string;
}

export interface KeyWrapRelayMessage {
  type: 'key-wrap';
  from: string;
  wrappedKey: string;
  iv: string;
  senderPublicKey: string;
}

export interface FileMetaRelayMessage {
  type: 'file-meta';
  from: string;
  fromName: string;
  fileId: string;
  name: string;
  mime: string;
  size: number;
  iv: string;
  totalChunks: number;
  kind: 'image' | 'file';
  ts: number;
}

export interface FileChunkRelayMessage {
  type: 'file-chunk';
  from: string;
  fileId: string;
  index: number;
  total: number;
  data: string;
}

export interface ReactionRelayMessage {
  type: 'reaction';
  from: string;
  fromName: string;
  messageId: string;
  emoji: string;
}

export interface RetractRelayMessage {
  type: 'retract';
  from: string;
  messageId: string;
}

export interface PongMessage {
  type: 'pong';
  ts: number;
}

export interface ErrorMessage {
  type: 'error';
  code: ErrorCode;
  message: string;
}

export interface SystemMessage {
  type: 'system';
  event: 'joined' | 'left' | 'media' | 'info';
  text: string;
  ts: number;
}

export interface RoomDestroyedMessage {
  type: 'room-destroyed';
  reason: 'empty' | 'expired' | 'inactivity' | 'max-lifetime' | 'shutdown';
}

export interface MediaStateRelayMessage {
  type: 'media-state';
  from: string;
  camera: boolean;
  microphone: boolean;
  screen: boolean;
}

export interface RateLimitedMessage {
  type: 'rate-limited';
  retryAfterMs: number;
}

export type ErrorCode =
  | 'invalid-name'
  | 'invalid-room-code'
  | 'room-not-found'
  | 'room-expired'
  | 'room-full'
  | 'unauthorized'
  | 'rate-limited'
  | 'payload-too-large'
  | 'invalid-message'
  | 'unsupported-file'
  | 'server-error';

export interface PublicParticipant {
  id: string;
  name: string;
  joinedAt: number;
  camera: boolean;
  microphone: boolean;
  screen: boolean;
}

export interface PublicConfig {
  maxParticipants: number;
  maxMessageChars: number;
  maxFileBytes: number;
  roomCodeMin: number;
  roomCodeMax: number;
  twilioEnabled: boolean;
  stunConfigured: boolean;
  turnConfigured: boolean;
}

export interface RTCIceServerLike {
  urls: string | string[];
  username?: string;
  credential?: string;
}
