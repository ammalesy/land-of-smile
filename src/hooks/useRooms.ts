import { useEffect, useState, useCallback } from "react";
import type { RoomInfo } from "@/app/api/rooms/route";

const POLL_INTERVAL_MS = 5_000;

interface UseRoomsResult {
  rooms: RoomInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useRooms(): UseRoomsResult {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms");
      if (!res.ok) throw new Error(`Failed to fetch rooms (${res.status})`);
      const data = await res.json();
      setRooms(data.rooms ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  return { rooms, loading, error, refresh: fetchRooms };
}
