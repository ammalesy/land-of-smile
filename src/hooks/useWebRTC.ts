import { useEffect, useRef, useState, useCallback } from "react";
import Ably from "ably";
import { Participant, SignalMessage } from "@/types";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export function useWebRTC(roomId: string, userId: string) {
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ablyRef = useRef<Ably.Realtime | null>(null);
  // Single channel for both signaling AND presence
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Use ref for handleSignal to avoid stale closure in channel.subscribe
  const handleSignalRef = useRef<(message: SignalMessage) => Promise<void>>(async () => {});

  // Update participants from Ably Presence — source of truth for who is in the room
  const syncPresence = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel) return;
    const members = await channel.presence.get();
    setParticipants(() => {
      const next = new Map<string, Participant>();
      members.forEach((m) => {
        if (m.clientId !== userId) {
          next.set(m.clientId, {
            userId: m.clientId,
            isMuted: (m.data as { isMuted?: boolean })?.isMuted ?? false,
            isSpeaking: false,
          });
        }
      });
      return next;
    });
  }, [userId]);

  const createPeerConnection = useCallback(
    (remoteUserId: string): RTCPeerConnection => {
      // Close existing connection if any to avoid duplicates
      const existing = peerConnectionsRef.current.get(remoteUserId);
      if (existing) {
        existing.close();
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Add local tracks to peer connection
      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      // Handle incoming remote audio — fix autoplay policy with explicit play()
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream) return;

        let audioEl = remoteAudioRefs.current.get(remoteUserId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          document.body.appendChild(audioEl); // must be in DOM for some browsers
          remoteAudioRefs.current.set(remoteUserId, audioEl);
        }
        audioEl.srcObject = remoteStream;
        audioEl.play().catch(() => {
          // Autoplay blocked — will play on next user interaction
        });
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
        console.log(`[WebRTC] ${remoteUserId} connectionState: ${pc.connectionState}`);
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          peerConnectionsRef.current.delete(remoteUserId);
          syncPresence();
        }
      };

      // Fallback: iceConnectionState is more reliable across browsers
      pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC] ${remoteUserId} iceConnectionState: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
          peerConnectionsRef.current.delete(remoteUserId);
          syncPresence();
        }
      };

      peerConnectionsRef.current.set(remoteUserId, pc);
      return pc;
    },
    [userId, syncPresence]
  );

  const handleSignal = useCallback(
    async (message: SignalMessage) => {
      const { type, from, to, payload } = message;

      // Ignore messages not meant for this user (except broadcasts)
      if (to && to !== userId) return;
      // Ignore own messages
      if (from === userId) return;

      console.log(`[Signal] received: ${type} from ${from}`);

      if (type === "user-joined") {
        // Someone joined — initiate offer (we are the existing user)
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
        // We received an offer — create answer
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
        if (pc && pc.signalingState !== "stable") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
        }
      }

      if (type === "ice-candidate") {
        const pc = peerConnectionsRef.current.get(from);
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit));
          } catch (e) {
            console.warn("[ICE] Failed to add candidate", e);
          }
        }
      }

      if (type === "user-left") {
        const pc = peerConnectionsRef.current.get(from);
        pc?.close();
        peerConnectionsRef.current.delete(from);
        const audioEl = remoteAudioRefs.current.get(from);
        if (audioEl) {
          audioEl.srcObject = null;
          audioEl.remove();
          remoteAudioRefs.current.delete(from);
        }
        syncPresence();
      }
    },
    [userId, createPeerConnection, syncPresence]
  );

  // Keep handleSignalRef up to date so channel.subscribe always calls latest version
  useEffect(() => {
    handleSignalRef.current = handleSignal;
  }, [handleSignal]);

  const joinRoom = useCallback(async () => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      // Connect to Ably with clientId for token auth
      const ably = new Ably.Realtime({
        authUrl: `/api/ably-token?clientId=${userId}`,
        clientId: userId,
      });
      ablyRef.current = ably;

      ably.connection.on("connected", () => {
        console.log("[Ably] Connected");
        setIsConnected(true);
      });
      ably.connection.on("disconnected", () => setIsConnected(false));
      ably.connection.on("failed", (err) => {
        setError(`Ably connection failed: ${err?.reason?.message ?? "unknown"}`);
      });

      // Single channel for both signaling and presence
      const channel = ably.channels.get(`voice-room:${roomId}`);
      channelRef.current = channel;

      // Listen for presence changes (enter/leave/update) → sync participant list
      channel.presence.subscribe(["enter", "leave", "update"], () => {
        syncPresence();
      });

      // Subscribe to signals
      await channel.subscribe("signal", (msg) => {
        handleSignalRef.current(msg.data as SignalMessage);
      });

      // Enter presence so others know we're here
      await channel.presence.enter({ isMuted: false });

      // Sync initial participant list
      await syncPresence();

      // Announce to existing users so they initiate WebRTC offers to us
      channel.publish("signal", {
        type: "user-joined",
        from: userId,
        payload: {},
      } as SignalMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    }
  }, [roomId, userId, syncPresence]);

  const leaveRoom = useCallback(() => {
    channelRef.current?.publish("signal", {
      type: "user-left",
      from: userId,
      payload: {},
    } as SignalMessage);

    channelRef.current?.presence.leave();

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    remoteAudioRefs.current.forEach((audio) => {
      audio.srcObject = null;
      audio.remove();
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
      const muted = !audioTrack.enabled;
      setIsMuted(muted);
      // Update presence so others see mute state
      channelRef.current?.presence.update({ isMuted: muted });
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
