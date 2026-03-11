import { useEffect, useRef, useState, useCallback } from "react";
import Ably from "ably";
import { Participant, SignalMessage } from "@/types";

export function useWebRTC(roomId: string, userId: string, displayName: string) {
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteScreenStream, setRemoteScreenStream] = useState<{ peerId: string; stream: MediaStream } | null>(null);

  const ablyRef = useRef<Ably.Realtime | null>(null);
  // Single channel for both signaling AND presence
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const screenPeerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  // ICE candidate queues — holds candidates that arrive before setRemoteDescription completes
  const iceCandidateQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const screenIceCandidateQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const iceServersRef = useRef<RTCIceServer[]>([
    { urls: "stun:stun.l.google.com:19302" },
  ]);

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
          const data = m.data as { isMuted?: boolean; displayName?: string; isScreenSharing?: boolean } | null;
          next.set(m.clientId, {
            userId: m.clientId,
            displayName: data?.displayName ?? m.clientId,
            isMuted: data?.isMuted ?? false,
            isSpeaking: false,
            isScreenSharing: data?.isScreenSharing ?? false,
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

      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

      // Add local tracks to peer connection
      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      // Handle incoming remote audio
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream) return;

        let audioEl = remoteAudioRefs.current.get(remoteUserId);
        if (!audioEl) {
          audioEl = document.createElement("audio");
          // Safari iOS requires these attributes
          audioEl.autoplay = true;
          audioEl.setAttribute("playsinline", "");
          audioEl.setAttribute("webkit-playsinline", "");
          audioEl.muted = false;
          document.body.appendChild(audioEl);
          remoteAudioRefs.current.set(remoteUserId, audioEl);
        }

        audioEl.srcObject = remoteStream;

        const playPromise = audioEl.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn("[Audio] Autoplay blocked (likely iOS):", err);
            // Signal to UI that user interaction is needed to unlock audio
            setAudioBlocked(true);
          });
        }
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

  const createScreenPeerConnection = useCallback(
    (remoteUserId: string, asReceiver: boolean): RTCPeerConnection => {
      const existing = screenPeerConnectionsRef.current.get(remoteUserId);
      if (existing) existing.close();

      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

      // Sender: add screen tracks
      if (!asReceiver && screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, screenStreamRef.current!);
        });
      }

      // Receiver: show incoming video stream
      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) {
          setRemoteScreenStream({ peerId: remoteUserId, stream });
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channelRef.current?.publish("signal", {
            type: "ice-candidate",
            from: `screen:${userId}`,
            to: `screen:${remoteUserId}`,
            payload: event.candidate.toJSON(),
          } as SignalMessage);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          screenPeerConnectionsRef.current.delete(remoteUserId);
        }
      };

      screenPeerConnectionsRef.current.set(remoteUserId, pc);
      return pc;
    },
    [userId]
  );

  const handleSignal = useCallback(
    async (message: SignalMessage) => {
      const { type, from, to, payload } = message;

      // Handle screen share ICE candidates (prefixed with "screen:")
      const isScreenFrom = from.startsWith("screen:");
      const isScreenTo = to?.startsWith("screen:");

      if (isScreenFrom || isScreenTo) {
        const actualFrom = isScreenFrom ? from.slice(7) : from;
        const actualTo = isScreenTo ? to!.slice(7) : to;
        if (actualTo && actualTo !== userId) return;
        if (actualFrom === userId) return;

        if (type === "offer") {
          const pc = createScreenPeerConnection(actualFrom, true);
          await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
          // Drain any ICE candidates that arrived before setRemoteDescription
          const queued = screenIceCandidateQueueRef.current.get(actualFrom) ?? [];
          for (const c of queued) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
          }
          screenIceCandidateQueueRef.current.delete(actualFrom);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channelRef.current?.publish("signal", {
            type: "answer",
            from: `screen:${userId}`,
            to: `screen:${actualFrom}`,
            payload: answer,
          } as SignalMessage);
        }

        if (type === "answer") {
          const pc = screenPeerConnectionsRef.current.get(actualFrom);
          if (pc && pc.signalingState !== "stable") {
            await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
            // Drain any ICE candidates that arrived before setRemoteDescription
            const queued = screenIceCandidateQueueRef.current.get(actualFrom) ?? [];
            for (const c of queued) {
              try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
            }
            screenIceCandidateQueueRef.current.delete(actualFrom);
          }
        }

        if (type === "ice-candidate") {
          const pc = screenPeerConnectionsRef.current.get(actualFrom);
          if (pc && pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit));
            } catch (e) {
              console.warn("[ICE Screen] Failed to add candidate", e);
            }
          } else {
            // Queue candidate until setRemoteDescription completes
            const q = screenIceCandidateQueueRef.current.get(actualFrom) ?? [];
            q.push(payload as RTCIceCandidateInit);
            screenIceCandidateQueueRef.current.set(actualFrom, q);
          }
        }
        return;
      }

      // Ignore messages not meant for this user (except broadcasts)
      if (to && to !== userId) return;
      // Ignore own messages
      if (from === userId) return;

      console.log(`[Signal] received: ${type} from ${from}`);

      if (type === "user-joined") {
        // Someone joined — initiate audio offer (we are the existing user)
        const pc = createPeerConnection(from);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channelRef.current?.publish("signal", {
          type: "offer",
          from: userId,
          to: from,
          payload: offer,
        } as SignalMessage);

        // If we are currently screen sharing, send a screen offer to the new peer too
        if (screenStreamRef.current) {
          const screenPc = createScreenPeerConnection(from, false);
          const screenOffer = await screenPc.createOffer();
          await screenPc.setLocalDescription(screenOffer);
          channelRef.current?.publish("signal", {
            type: "offer",
            from: `screen:${userId}`,
            to: `screen:${from}`,
            payload: screenOffer,
          } as SignalMessage);
        }
      }

      if (type === "offer") {
        // We received an audio offer — create answer
        const pc = createPeerConnection(from);
        await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
        // Drain any ICE candidates that arrived before setRemoteDescription
        const queued = iceCandidateQueueRef.current.get(from) ?? [];
        for (const c of queued) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
        }
        iceCandidateQueueRef.current.delete(from);

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
          // Drain any ICE candidates that arrived before setRemoteDescription
          const queued = iceCandidateQueueRef.current.get(from) ?? [];
          for (const c of queued) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
          }
          iceCandidateQueueRef.current.delete(from);
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
        } else {
          // Queue candidate until setRemoteDescription completes
          const q = iceCandidateQueueRef.current.get(from) ?? [];
          q.push(payload as RTCIceCandidateInit);
          iceCandidateQueueRef.current.set(from, q);
        }
      }

      if (type === "user-left") {
        const pc = peerConnectionsRef.current.get(from);
        pc?.close();
        peerConnectionsRef.current.delete(from);
        iceCandidateQueueRef.current.delete(from);
        const audioEl = remoteAudioRefs.current.get(from);
        if (audioEl) {
          audioEl.srcObject = null;
          audioEl.remove();
          remoteAudioRefs.current.delete(from);
        }
        // Clean up screen share PC if they disconnected
        const screenPc = screenPeerConnectionsRef.current.get(from);
        screenPc?.close();
        screenPeerConnectionsRef.current.delete(from);
        screenIceCandidateQueueRef.current.delete(from);
        setRemoteScreenStream((prev) => (prev?.peerId === from ? null : prev));
        syncPresence();
      }

      if (type === "screen-share-start") {
        console.log(`[ScreenShare] ${from} started sharing`);
        syncPresence();
      }

      if (type === "screen-share-stop") {
        console.log(`[ScreenShare] ${from} stopped sharing`);
        const screenPc = screenPeerConnectionsRef.current.get(from);
        screenPc?.close();
        screenPeerConnectionsRef.current.delete(from);
        screenIceCandidateQueueRef.current.delete(from);
        setRemoteScreenStream((prev) => (prev?.peerId === from ? null : prev));
        syncPresence();
      }
    },
    [userId, createPeerConnection, createScreenPeerConnection, syncPresence]
  );

  // Keep handleSignalRef up to date so channel.subscribe always calls latest version
  useEffect(() => {
    handleSignalRef.current = handleSignal;
  }, [handleSignal]);

  const joinRoom = useCallback(async () => {
    try {
      // Fetch ICE servers (STUN + TURN) from API — keeps credentials server-side
      try {
        const iceRes = await fetch("/api/ice-servers");
        if (iceRes.ok) {
          const { iceServers } = await iceRes.json();
          iceServersRef.current = iceServers;
          console.log("[ICE] Loaded", iceServers.length, "servers");
        }
      } catch {
        console.warn("[ICE] Failed to fetch ICE servers, using STUN only");
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      // Use authCallback instead of authUrl for full control — always returns a fresh token
      const ably = new Ably.Realtime({
        clientId: userId,
        authCallback: async (_data, callback) => {
          try {
            const res = await fetch(`/api/ably-token?clientId=${userId}&t=${Date.now()}`);
            if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
            const tokenRequest = await res.json();
            callback(null, tokenRequest);
          } catch (err) {
            callback(String(err), null);
          }
        },
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
      await channel.presence.enter({ isMuted: false, displayName });

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
    // Stop screen share before leaving
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    screenPeerConnectionsRef.current.forEach((pc) => pc.close());
    screenPeerConnectionsRef.current.clear();
    setIsScreenSharing(false);
    setRemoteScreenStream(null);

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

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      screenStreamRef.current = screenStream;
      setIsScreenSharing(true);

      // Update presence so others see we're sharing
      channelRef.current?.presence.update({ isMuted: isMuted, displayName, isScreenSharing: true });

      // Broadcast screen-share-start so all peers know to expect an offer
      channelRef.current?.publish("signal", {
        type: "screen-share-start",
        from: userId,
        payload: {},
      } as SignalMessage);

      // Send screen offer to every connected peer
      const peerIds = Array.from(peerConnectionsRef.current.keys());
      for (const peerId of peerIds) {
        const pc = createScreenPeerConnection(peerId, false);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channelRef.current?.publish("signal", {
          type: "offer",
          from: `screen:${userId}`,
          to: `screen:${peerId}`,
          payload: offer,
        } as SignalMessage);
      }

      // Auto-stop when user ends share via OS dialog
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      // User cancelled or permission denied — not a fatal error
      console.warn("[ScreenShare] getDisplayMedia failed:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, displayName, isMuted, createScreenPeerConnection]);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    screenPeerConnectionsRef.current.forEach((pc) => pc.close());
    screenPeerConnectionsRef.current.clear();

    setIsScreenSharing(false);

    channelRef.current?.presence.update({ isMuted: isMuted, displayName, isScreenSharing: false });

    channelRef.current?.publish("signal", {
      type: "screen-share-stop",
      from: userId,
      payload: {},
    } as SignalMessage);
  }, [userId, displayName, isMuted]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const muted = !audioTrack.enabled;
      setIsMuted(muted);
      // Update presence so others see mute state (preserve isScreenSharing)
      channelRef.current?.presence.update({ isMuted: muted, displayName, isScreenSharing });
    }
  }, [displayName, isScreenSharing]);

  const toggleSoundMute = useCallback(() => {
    setIsSoundMuted((prev) => {
      const next = !prev;
      // Mute/unmute all remote audio elements
      remoteAudioRefs.current.forEach((audio) => {
        audio.muted = next;
      });
      return next;
    });
  }, []);

  // Called from a user gesture (tap) to unlock audio on iOS Safari
  const unlockAudio = useCallback(() => {
    remoteAudioRefs.current.forEach((audio) => {
      if (audio.paused) {
        audio.play().catch(() => {});
      }
    });
    setAudioBlocked(false);
  }, []);

  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, [leaveRoom]);

  return {
    participants,
    isMuted,
    isSoundMuted,
    isConnected,
    audioBlocked,
    error,
    isScreenSharing,
    remoteScreenStream,
    joinRoom,
    leaveRoom,
    toggleMute,
    toggleSoundMute,
    unlockAudio,
    startScreenShare,
    stopScreenShare,
  };
}
