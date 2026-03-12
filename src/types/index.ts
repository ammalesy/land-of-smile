export interface Participant {
  userId: string;
  displayName: string;
  isMuted: boolean;
  isSpeaking: boolean;
  isScreenSharing: boolean;
}

export type SignalType =
  | "offer"
  | "answer"
  | "ice-candidate"
  | "user-joined"
  | "user-left"
  | "screen-share-start"
  | "screen-share-stop";

export interface SignalMessage {
  type: SignalType;
  from: string;
  to?: string;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, unknown>;
}

export type DebugLevel = "info" | "success" | "warn" | "error";
export type DebugCategory = "ably" | "presence" | "signal" | "ice" | "webrtc" | "audio" | "screen";

export interface DebugLogEntry {
  id: number;
  ts: Date;
  level: DebugLevel;
  category: DebugCategory;
  message: string;
}
