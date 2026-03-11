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
