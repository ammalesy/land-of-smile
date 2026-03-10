import { useEffect, useRef, useState, useCallback } from "react";
import Ably from "ably";
import { Participant, SignalMessage } from "@/types";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useWebRTC(roomId: string, userId: string) {
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ablyRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const createPeerConnection = useCallback(
    (remoteUserId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Add local tracks to peer connection
      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      // Handle incoming remote audio
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        let audioEl = remoteAudioRefs.current.get(remoteUserId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          remoteAudioRefs.current.set(remoteUserId, audioEl);
        }
        audioEl.srcObject = remoteStream;
      };

      // Send ICE candidates via Ably
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channelRef.current?.publish("signal", {
            type: "ice-candidate",
            from: userId,
            to: remoteUserId,
            payload: event.candidate.toJSON(),
          } as SignalMessage);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setParticipants((prev) => {
            const next = new Map(prev);
            next.set(remoteUserId, { userId: remoteUserId, isMuted: false, isSpeaking: false });
            return next;
          });
        }
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          setParticipants((prev) => {
            const next = new Map(prev);
            next.delete(remoteUserId);
            return next;
          });
          peerConnectionsRef.current.delete(remoteUserId);
        }
      };

      peerConnectionsRef.current.set(remoteUserId, pc);
      return pc;
    },
    [userId]
  );

  const handleSignal = useCallback(
    async (message: SignalMessage) => {
      const { type, from, to, payload } = message;

      // Ignore messages not meant for this user (except broadcasts)
      if (to && to !== userId) return;
      // Ignore own messages
      if (from === userId) return;

      if (type === "user-joined") {
        // Someone joined — initiate offer
        const pc = createPeerConnection(from);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channelRef.current?.publish("signal", {
          type: "offer",
          from: userId,
          to: from,
          payload: offer,
        } as SignalMessage);
      }

      if (type === "offer") {
        const pc = createPeerConnection(from);
        await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channelRef.current?.publish("signal", {
          type: "answer",
          from: userId,
          to: from,
          payload: answer,
        } as SignalMessage);
      }

      if (type === "answer") {
        const pc = peerConnectionsRef.current.get(from);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
        }
      }

      if (type === "ice-candidate") {
        const pc = peerConnectionsRef.current.get(from);
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit));
        }
      }

      if (type === "user-left") {
        const pc = peerConnectionsRef.current.get(from);
        pc?.close();
        peerConnectionsRef.current.delete(from);
        remoteAudioRefs.current.delete(from);
        setParticipants((prev) => {
          const next = new Map(prev);
          next.delete(from);
          return next;
        });
      }
    },
    [userId, createPeerConnection]
  );

  const joinRoom = useCallback(async () => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      // Connect to Ably
      const ably = new Ably.Realtime({ authUrl: "/api/ably-token" });
      ablyRef.current = ably;

      ably.connection.on("connected", () => setIsConnected(true));
      ably.connection.on("disconnected", () => setIsConnected(false));

      const channel = ably.channels.get(`voice-room:${roomId}`);
      channelRef.current = channel;

      // Listen for signals
      channel.subscribe("signal", (msg) => {
        handleSignal(msg.data as SignalMessage);
      });

      // Announce presence
      channel.publish("signal", {
        type: "user-joined",
        from: userId,
        payload: {},
      } as SignalMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    }
  }, [roomId, userId, handleSignal]);

  const leaveRoom = useCallback(() => {
    channelRef.current?.publish("signal", {
      type: "user-left",
      from: userId,
      payload: {},
    } as SignalMessage);

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    remoteAudioRefs.current.forEach((audio) => {
      audio.srcObject = null;
    });
    remoteAudioRefs.current.clear();

    ablyRef.current?.close();
    setIsConnected(false);
    setParticipants(new Map());
  }, [userId]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }, []);

  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, [leaveRoom]);

  return {
    participants,
    isMuted,
    isConnected,
    error,
    joinRoom,
    leaveRoom,
    toggleMute,
  };
}
