import { useEffect, useRef, useState, useCallback } from "react";
import Ably from "ably";
import { DebugCategory, DebugLevel, Participant, SignalMessage, ThemeId } from "@/types";

type LogFn = (level: DebugLevel, category: DebugCategory, message: string) => void;

export function useWebRTC(
  roomId: string,
  userId: string,
  displayName: string,
  roomName: string = "",
  onLog?: LogFn,
  initialTheme?: ThemeId,
  onThemeChange?: (themeId: ThemeId) => void,
) {
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

  // Use refs for signal/reconnect/presence handlers to avoid stale closures in callbacks
  const handleSignalRef = useRef<(message: SignalMessage) => Promise<void>>(async () => {});
  const reconnectPeerRef = useRef<(remoteUserId: string) => Promise<void>>(async () => {});
  const handlePresenceEnterRef = useRef<(remoteUserId: string) => Promise<void>>(async () => {});

  // Theme — keep current theme in a ref so presence.update always sends the latest value
  const roomThemeRef = useRef<ThemeId>(initialTheme ?? "galaxy");
  const onThemeChangeRef = useRef<((themeId: ThemeId) => void) | undefined>(onThemeChange);
  useEffect(() => { onThemeChangeRef.current = onThemeChange; }, [onThemeChange]);
  // Guard: only apply incoming room theme once per session (avoid overwriting creator's pick)
  const hasAppliedRoomThemeRef = useRef(false);
  // If we are the creator (initialTheme was passed), mark as already applied so we don't overwrite
  useEffect(() => { if (initialTheme) hasAppliedRoomThemeRef.current = true; }, []);  // eslint-disable-line

  // Debug logger — kept in a ref so callbacks never go stale
  const onLogRef = useRef<LogFn | undefined>(onLog);
  useEffect(() => { onLogRef.current = onLog; }, [onLog]);
  const log = useCallback((level: DebugLevel, category: DebugCategory, message: string) => {
    onLogRef.current?.(level, category, message);
  }, []);

  // Update participants from Ably Presence — source of truth for who is in the room
  const syncPresence = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel) return;
    const members = await channel.presence.get();
    // Pick up room theme from any existing member (for late joiners)
    if (!hasAppliedRoomThemeRef.current) {
      const withTheme = members.find(
        (m) => m.clientId !== userId && (m.data as { roomTheme?: ThemeId })?.roomTheme,
      );
      if (withTheme) {
        const t = (withTheme.data as { roomTheme?: ThemeId }).roomTheme!;
        hasAppliedRoomThemeRef.current = true;
        roomThemeRef.current = t;
        onThemeChangeRef.current?.(t);
      }
    }
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
        log("warn", "webrtc", `Re-creating PC for ${remoteUserId} (closing existing)`);
        existing.close();
      }

      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      log("info", "webrtc", `Created RTCPeerConnection for ${remoteUserId}`);

      // Add local tracks to peer connection
      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      // Handle incoming remote audio
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream) return;
        log("info", "audio", `ontrack fired for ${remoteUserId} — attaching audio stream`);

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
          playPromise
            .then(() => log("success", "audio", `audio.play() OK for ${remoteUserId}`))
            .catch((err) => {
              console.warn("[Audio] Autoplay blocked (likely iOS):", err);
              log("warn", "audio", `audio.play() blocked for ${remoteUserId}: ${err}`);
              setAudioBlocked(true);
            });
        }
      };

      // Send ICE candidates via Ably
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          log("info", "ice", `Sending ICE candidate to ${remoteUserId}: ${event.candidate.type ?? ""} ${event.candidate.address ?? ""}`);
          channelRef.current?.publish("signal", {
            type: "ice-candidate",
            from: userId,
            to: remoteUserId,
            payload: event.candidate.toJSON(),
          } as SignalMessage);
        } else {
          log("info", "ice", `ICE gathering complete for ${remoteUserId}`);
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        const lvl: DebugLevel = state === "connected" ? "success" : state === "failed" ? "error" : "info";
        log(lvl, "webrtc", `${remoteUserId} connectionState → ${state}`);
        console.log(`[WebRTC] ${remoteUserId} connectionState: ${state}`);
        if (state === "failed") {
          peerConnectionsRef.current.delete(remoteUserId);
          iceCandidateQueueRef.current.delete(remoteUserId);
          if (userId > remoteUserId) {
            log("warn", "webrtc", `Triggering reconnect to ${remoteUserId} (we are offerer)`);
            console.log(`[WebRTC] Reconnecting to ${remoteUserId} (offerer role)...`);
            reconnectPeerRef.current(remoteUserId);
          }
        }
      };

      // ICE disconnected is transient — give it 5s to recover before forcing a reconnect.
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        const lvl: DebugLevel = (state === "connected" || state === "completed") ? "success" : state === "failed" ? "error" : "info";
        log(lvl, "ice", `${remoteUserId} iceConnectionState → ${state}`);
        console.log(`[WebRTC] ${remoteUserId} iceConnectionState: ${state}`);
        if (state === "disconnected") {
          setTimeout(() => {
            const currentPc = peerConnectionsRef.current.get(remoteUserId);
            if (
              currentPc === pc &&
              (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed")
            ) {
              console.warn(`[WebRTC] ICE still disconnected for ${remoteUserId}, forcing reconnect...`);
              log("warn", "ice", `ICE still disconnected after 5s for ${remoteUserId} — forcing reconnect`);
              peerConnectionsRef.current.delete(remoteUserId);
              iceCandidateQueueRef.current.delete(remoteUserId);
              if (userId > remoteUserId) {
                reconnectPeerRef.current(remoteUserId);
              }
            }
          }, 5000);
        }
      };

      peerConnectionsRef.current.set(remoteUserId, pc);
      return pc;
    },
    [userId, syncPresence, log]
  );

  const createScreenPeerConnection = useCallback(
    (remoteUserId: string, asReceiver: boolean, stream?: MediaStream): RTCPeerConnection => {
      const existing = screenPeerConnectionsRef.current.get(remoteUserId);
      if (existing) existing.close();

      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

      // Sender: add screen tracks — use explicit stream arg first, fallback to ref
      const sourceStream = stream ?? screenStreamRef.current;
      if (!asReceiver && sourceStream) {
        sourceStream.getTracks().forEach((track) => {
          pc.addTrack(track, sourceStream);
        });
        console.log("[ScreenShare] addTrack called, tracks:", sourceStream.getTracks().length);
      }

      // Receiver: buffer incoming stream and only surface it once ICE is connected
      let pendingStream: MediaStream | null = null;
      pc.ontrack = (event) => {
        const [incomingStream] = event.streams;
        if (!incomingStream) return;
        pendingStream = incomingStream;
        // If already connected (e.g. fast local network), show immediately
        if (pc.connectionState === "connected" || pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          setRemoteScreenStream({ peerId: remoteUserId, stream: incomingStream });
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

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        const lvl: DebugLevel = (state === "connected" || state === "completed") ? "success" : state === "failed" ? "error" : "info";
        log(lvl, "screen", `${remoteUserId} screen iceConnectionState → ${state}`);
        console.log(`[ScreenShare] ${remoteUserId} iceConnectionState: ${state}`);
        if ((state === "connected" || state === "completed") && pendingStream && asReceiver) {
          setRemoteScreenStream({ peerId: remoteUserId, stream: pendingStream });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        const lvl: DebugLevel = state === "connected" ? "success" : state === "failed" ? "error" : "info";
        log(lvl, "screen", `${remoteUserId} screen connectionState → ${state}`);
        console.log(`[ScreenShare] ${remoteUserId} connectionState: ${state}`);
        if (state === "connected" && pendingStream && asReceiver) {
          setRemoteScreenStream({ peerId: remoteUserId, stream: pendingStream });
        }
        if (state === "disconnected" || state === "failed") {
          screenPeerConnectionsRef.current.delete(remoteUserId);
        }
      };

      screenPeerConnectionsRef.current.set(remoteUserId, pc);
      return pc;
    },
    [userId, log]
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
      log("info", "signal", `← ${type} from ${from}`);

      if (type === "user-joined") {
        // Screen share is sharer-driven (not gated by offerer role): always send a screen
        // offer to the new peer if we are currently sharing, regardless of userId ordering.
        // Do this BEFORE the audio-offerer guard so we never skip it.
        if (screenStreamRef.current) {
          const existingScreenPc = screenPeerConnectionsRef.current.get(from);
          const screenPcAlive =
            existingScreenPc &&
            existingScreenPc.connectionState !== "failed" &&
            existingScreenPc.connectionState !== "closed";
          if (!screenPcAlive) {
            try {
              const screenPc = createScreenPeerConnection(from, false, screenStreamRef.current);
              const screenOffer = await screenPc.createOffer();
              await screenPc.setLocalDescription(screenOffer);
              channelRef.current?.publish("signal", {
                type: "offer",
                from: `screen:${userId}`,
                to: `screen:${from}`,
                payload: screenOffer,
              } as SignalMessage);
              log("success", "screen", `→ screen offer sent to ${from} (user-joined fallback)`);
            } catch (err) {
              console.error(`[ScreenShare] Failed to send screen offer to ${from}:`, err);
              log("error", "screen", `Failed to send screen offer to ${from}: ${err}`);
            }
          }
        }

        // Audio offer: backup path — presence-enter already handles this in most cases.
        // Only proceed if no live audio peer connection exists yet for this user.
        const existingPc = peerConnectionsRef.current.get(from);
        if (
          existingPc &&
          existingPc.connectionState !== "failed" &&
          existingPc.connectionState !== "closed"
        ) {
          log("info", "signal", `user-joined from ${from} — audio PC already alive, skipping offer`);
          return;
        }
        // user-joined has no "to" field (broadcast), so all existing users receive it.
        // Use the same deterministic offerer rule: only the higher-userId side offers.
        if (userId <= from) {
          log("info", "signal", `user-joined from ${from} — we are answerer, waiting for their offer`);
          return;
        }
        const pc = createPeerConnection(from);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channelRef.current?.publish("signal", {
          type: "offer",
          from: userId,
          to: from,
          payload: offer,
        } as SignalMessage);
        log("success", "signal", `→ audio offer sent to ${from} (user-joined fallback)`);
      }

      if (type === "offer") {
        // We received an audio offer — create answer
        const pc = createPeerConnection(from);
        await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
        const queued = iceCandidateQueueRef.current.get(from) ?? [];
        if (queued.length) log("info", "ice", `Draining ${queued.length} queued ICE candidate(s) for ${from}`);
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
        log("success", "signal", `→ answer sent to ${from}`);
      }

      if (type === "answer") {
        const pc = peerConnectionsRef.current.get(from);
        if (pc && pc.signalingState !== "stable") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
          const queued = iceCandidateQueueRef.current.get(from) ?? [];
          if (queued.length) log("info", "ice", `Draining ${queued.length} queued ICE candidate(s) for ${from}`);
          for (const c of queued) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
          }
          iceCandidateQueueRef.current.delete(from);
          log("success", "signal", `answer from ${from} applied`);
        } else {
          log("warn", "signal", `answer from ${from} ignored — signalingState: ${pc?.signalingState ?? "no PC"}`);
        }
      }

      if (type === "ice-candidate") {
        const pc = peerConnectionsRef.current.get(from);
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit));
            log("info", "ice", `ICE candidate from ${from} added`);
          } catch (e) {
            console.warn("[ICE] Failed to add candidate", e);
            log("error", "ice", `Failed to add ICE candidate from ${from}: ${e}`);
          }
        } else {
          const q = iceCandidateQueueRef.current.get(from) ?? [];
          q.push(payload as RTCIceCandidateInit);
          iceCandidateQueueRef.current.set(from, q);
          log("warn", "ice", `ICE candidate from ${from} queued (remoteDescription not set yet), queue size: ${q.length}`);
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

      if (type === "theme-change") {
        const { themeId } = payload as { themeId: ThemeId };
        hasAppliedRoomThemeRef.current = true;
        roomThemeRef.current = themeId;
        onThemeChangeRef.current?.(themeId);
        log("info", "signal", `← theme-change: ${themeId} from ${from}`);
      }
    },
    [userId, createPeerConnection, createScreenPeerConnection, syncPresence, log]
  );

  // Keep handleSignalRef up to date so channel.subscribe always calls latest version
  useEffect(() => {
    handleSignalRef.current = handleSignal;
  }, [handleSignal]);

  // Reconnects a specific peer by sending a fresh offer (offerer role only).
  const reconnectPeer = useCallback(
    async (remoteUserId: string) => {
      if (!channelRef.current) return;
      console.log(`[WebRTC] Sending reconnect offer to ${remoteUserId}`);
      log("warn", "webrtc", `Sending reconnect offer to ${remoteUserId}`);
      const pc = createPeerConnection(remoteUserId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channelRef.current.publish("signal", {
          type: "offer",
          from: userId,
          to: remoteUserId,
          payload: offer,
        } as SignalMessage);
        log("success", "signal", `→ reconnect offer sent to ${remoteUserId}`);
      } catch (err) {
        console.error(`[WebRTC] Reconnect offer failed for ${remoteUserId}:`, err);
        log("error", "webrtc", `Reconnect offer failed for ${remoteUserId}: ${err}`);
      }
    },
    [userId, createPeerConnection, log]
  );

  useEffect(() => {
    reconnectPeerRef.current = reconnectPeer;
  }, [reconnectPeer]);

  // Handles a remote user entering presence:
  // 1. Initiates a WebRTC audio offer if we are the offerer (higher userId).
  // 2. Always sends a screen share offer if we are currently sharing
  //    (screen share is sharer-driven, not gated by the audio offerer role).
  const handlePresenceEnter = useCallback(
    async (remoteUserId: string) => {
      if (!localStreamRef.current) return;
      if (remoteUserId === userId) return;

      log("info", "presence", `${remoteUserId} entered presence`);

      // Screen share: sharer always offers to the new peer regardless of userId ordering.
      if (screenStreamRef.current) {
        const existingScreenPc = screenPeerConnectionsRef.current.get(remoteUserId);
        const screenPcAlive =
          existingScreenPc &&
          existingScreenPc.connectionState !== "failed" &&
          existingScreenPc.connectionState !== "closed";
        if (!screenPcAlive) {
          try {
            const screenPc = createScreenPeerConnection(remoteUserId, false, screenStreamRef.current);
            const screenOffer = await screenPc.createOffer();
            await screenPc.setLocalDescription(screenOffer);
            channelRef.current?.publish("signal", {
              type: "offer",
              from: `screen:${userId}`,
              to: `screen:${remoteUserId}`,
              payload: screenOffer,
            } as SignalMessage);
            log("success", "screen", `→ screen offer sent to ${remoteUserId} (presence-driven)`);
          } catch (err) {
            console.error(`[ScreenShare] Presence-driven screen offer failed for ${remoteUserId}:`, err);
            log("error", "screen", `Screen offer failed for ${remoteUserId}: ${err}`);
          }
        }
      }

      // Audio: only the higher-userId side offers; the other waits for the incoming offer.
      if (userId <= remoteUserId) {
        log("info", "webrtc", `${remoteUserId} entered — we are answerer, waiting for their audio offer`);
        return;
      }
      // Skip if we already have a live audio peer connection for this user.
      const existingPc = peerConnectionsRef.current.get(remoteUserId);
      if (
        existingPc &&
        existingPc.connectionState !== "failed" &&
        existingPc.connectionState !== "closed"
      ) {
        log("info", "webrtc", `${remoteUserId} entered — audio PC already alive (${existingPc.connectionState}), skipping offer`);
        return;
      }
      console.log(`[WebRTC] Presence-driven audio offer to ${remoteUserId}`);
      const pc = createPeerConnection(remoteUserId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channelRef.current?.publish("signal", {
          type: "offer",
          from: userId,
          to: remoteUserId,
          payload: offer,
        } as SignalMessage);
        log("success", "signal", `→ audio offer sent to ${remoteUserId} (presence-driven)`);
      } catch (err) {
        console.error(`[WebRTC] Presence-driven audio offer failed for ${remoteUserId}:`, err);
        log("error", "webrtc", `Audio offer failed for ${remoteUserId}: ${err}`);
      }
    },
    [userId, createPeerConnection, createScreenPeerConnection, log]
  );

  useEffect(() => {
    handlePresenceEnterRef.current = handlePresenceEnter;
  }, [handlePresenceEnter]);

  const joinRoom = useCallback(async () => {
    try {
      // Fetch ICE servers (STUN + TURN) from API — keeps credentials server-side
      try {
        const iceRes = await fetch("/api/ice-servers");
        if (iceRes.ok) {
          const { iceServers } = await iceRes.json();
          iceServersRef.current = iceServers;
          console.log("[ICE] Loaded", iceServers.length, "servers");
          log("success", "ice", `Loaded ${iceServers.length} ICE server(s) from API`);
        } else {
          log("warn", "ice", `ICE servers API returned ${iceRes.status}, using STUN only`);
        }
      } catch (e) {
        console.warn("[ICE] Failed to fetch ICE servers, using STUN only");
        log("warn", "ice", `Failed to fetch ICE servers: ${e}. Using STUN only.`);
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      log("success", "audio", `Microphone acquired (${stream.getAudioTracks().length} track(s))`);

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
        log("success", "ably", "Ably connection established");
        setIsConnected(true);
      });
      ably.connection.on("disconnected", () => {
        log("warn", "ably", "Ably connection disconnected");
        setIsConnected(false);
      });
      ably.connection.on("failed", (err) => {
        const msg = err?.reason?.message ?? "unknown";
        log("error", "ably", `Ably connection failed: ${msg}`);
        setError(`Ably connection failed: ${msg}`);
      });

      // Single channel for both signaling and presence
      const channel = ably.channels.get(`voice-room:${roomId}`);
      channelRef.current = channel;

      // Explicitly wait for the Ably channel to be fully attached before any
      // presence/signal work — prevents offers arriving before we can receive them.
      await channel.attach();
      log("success", "ably", `Channel voice-room:${roomId} attached`);

      // Subscribe to signals
      await channel.subscribe("signal", (msg) => {
        handleSignalRef.current(msg.data as SignalMessage);
      });
      log("success", "ably", "Subscribed to signal messages");

      // Listen for presence changes (enter/leave/update) → sync participant list
      // and trigger WebRTC offer for new entrants (where we are the offerer).
      await channel.presence.subscribe(["enter", "leave", "update"], (member) => {
        syncPresence();
        if (member.action === "enter") {
          log("info", "presence", `Presence event: ${member.clientId} entered`);
          handlePresenceEnterRef.current(member.clientId);
        } else if (member.action === "leave") {
          log("info", "presence", `Presence event: ${member.clientId} left`);
        }
      });
      log("success", "ably", "Subscribed to presence events");

      // Enter presence so others know we're here.
      await channel.presence.enter({ isMuted: false, displayName, roomName, roomTheme: roomThemeRef.current });
      log("success", "presence", `Entered presence as ${userId} (${displayName})`);

      // Sync the initial participant list.
      await syncPresence();

      // As the new joiner, initiate offers to all already-present members
      // where WE are the offerer (higher userId).
      const existingMembers = await channel.presence.get();
      const others = existingMembers.filter((m) => m.clientId !== userId);
      log("info", "presence", `Found ${others.length} existing member(s): ${others.map((m) => m.clientId).join(", ") || "none"}`);
      for (const member of others) {
        await handlePresenceEnterRef.current(member.clientId);
      }

      // Broadcast "user-joined" as a fallback.
      channel.publish("signal", {
        type: "user-joined",
        from: userId,
        payload: {},
      } as SignalMessage);
      log("info", "signal", `→ broadcast user-joined`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to join room";
      log("error", "ably", `joinRoom failed: ${msg}`);
      setError(msg);
    }
  }, [roomId, userId, displayName, roomName, syncPresence, log]);

  const leaveRoom = useCallback(() => {
    log("info", "presence", `Leaving room ${roomId}`);
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
  }, [userId, roomId, log]);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });

      // Set ref BEFORE createScreenPeerConnection so addTrack can use it
      screenStreamRef.current = screenStream;

      // Update presence & broadcast intent
      setIsScreenSharing(true);
      channelRef.current?.presence.update({ isMuted: isMuted, displayName, roomName, isScreenSharing: true, roomTheme: roomThemeRef.current });
      channelRef.current?.publish("signal", {
        type: "screen-share-start",
        from: userId,
        payload: {},
      } as SignalMessage);

      // Send screen offer to every connected peer
      const peerIds = Array.from(peerConnectionsRef.current.keys());
      console.log("[ScreenShare] starting share, peers:", peerIds);
      log("info", "screen", `Screen share started — sending offers to ${peerIds.length} peer(s): ${peerIds.join(", ") || "none"}`);

      for (const peerId of peerIds) {
        // Pass screenStream explicitly so addTrack is guaranteed even if ref timing is off
        const pc = createScreenPeerConnection(peerId, false, screenStream);

        console.log("[ScreenShare] senders after addTrack:", pc.getSenders().length);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channelRef.current?.publish("signal", {
          type: "offer",
          from: `screen:${userId}`,
          to: `screen:${peerId}`,
          payload: offer,
        } as SignalMessage);
        log("success", "screen", `→ screen offer sent to ${peerId}`);
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
    log("info", "screen", "Screen share stopped");
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    screenPeerConnectionsRef.current.forEach((pc) => pc.close());
    screenPeerConnectionsRef.current.clear();

    setIsScreenSharing(false);

    channelRef.current?.presence.update({ isMuted: isMuted, displayName, roomName, isScreenSharing: false, roomTheme: roomThemeRef.current });

    channelRef.current?.publish("signal", {
      type: "screen-share-stop",
      from: userId,
      payload: {},
    } as SignalMessage);
  }, [userId, displayName, isMuted, log]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const muted = !audioTrack.enabled;
      setIsMuted(muted);
      // Update presence so others see mute state (preserve isScreenSharing)
      channelRef.current?.presence.update({ isMuted: muted, displayName, roomName, isScreenSharing, roomTheme: roomThemeRef.current });
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

  const changeRoomTheme = useCallback(
    (themeId: ThemeId) => {
      roomThemeRef.current = themeId;
      // Broadcast to everyone in the room
      channelRef.current?.publish("signal", {
        type: "theme-change",
        from: userId,
        payload: { themeId },
      } as SignalMessage);
      // Update own presence so late joiners get the latest theme
      channelRef.current?.presence.update({
        isMuted,
        displayName,
        roomName,
        isScreenSharing,
        roomTheme: themeId,
      });
      log("info", "signal", `→ theme-change broadcast: ${themeId}`);
    },
    [userId, isMuted, displayName, roomName, isScreenSharing, log],
  );

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
    changeRoomTheme,
  };
}
