import { useCallback, useEffect, useRef, useState } from "react";

import { ALERT_LEAD_SECONDS, loadNewsEvents, type NewsEvent } from "./calendar";
import { refreshNewsFromSupabase } from "./remoteNews";

/**
 * Watches the replay clock. An alert fires when the clock moves forward across
 * "event time minus 30 minutes". Jumping past an event entirely does not alert.
 * Stepping back re-arms alerts for events still ahead, so a replay alerts again.
 */
export function useNewsAlerts(sessionId: string | null, currentTime: number | null) {
  const [events, setEvents] = useState<NewsEvent[]>([]);
  const [alerts, setAlerts] = useState<NewsEvent[]>([]);
  const lastRef = useRef<number | null>(null);
  const sessionRef = useRef<string | null>(null);
  const firedRef = useRef(new Map<string, number>());

  const reload = useCallback(() => {
    setEvents(loadNewsEvents());
  }, []);

  useEffect(() => {
    reload();
    let cancelled = false;
    refreshNewsFromSupabase()
      .then((ev) => {
        if (!cancelled) setEvents(ev);
      })
      .catch((err) => {
        console.warn("[News] Supabase unavailable, using saved copy:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    if (sessionId === null || currentTime === null) return;

    if (sessionRef.current !== sessionId) {
      sessionRef.current = sessionId;
      firedRef.current.clear();
      lastRef.current = currentTime;
      setAlerts([]);
      return;
    }

    const prev = lastRef.current;
    lastRef.current = currentTime;
    if (prev === null || currentTime === prev) return;

    if (currentTime < prev) {
      for (const [key, trigger] of firedRef.current) {
        if (trigger > currentTime) firedRef.current.delete(key);
      }
      return;
    }

    const hits: NewsEvent[] = [];
    for (const e of events) {
      if (e.utc === null) continue;
      const trigger = e.utc - ALERT_LEAD_SECONDS;
      const key = `${e.utc}|${e.event}`;
      if (trigger > prev && trigger <= currentTime && currentTime < e.utc && !firedRef.current.has(key)) {
        firedRef.current.set(key, trigger);
        hits.push(e);
      }
    }
    if (hits.length > 0) setAlerts((a) => [...hits, ...a].slice(0, 5));
  }, [sessionId, currentTime, events]);

  const dismiss = useCallback((e: NewsEvent) => {
    setAlerts((a) => a.filter((x) => !(x.utc === e.utc && x.event === e.event)));
  }, []);

  return { events, alerts, dismiss, reload };
}
