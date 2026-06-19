"use client";

import { useEffect } from "react";

import { api } from "@/trpc/react";

/**
 * Persists the browser's IANA timezone to the user once, so server-rendered
 * reminder emails can show contest times in the user's zone. Renders nothing.
 * Only mounted for signed-in users; skips the network call when unchanged.
 */
export function TimezoneSync() {
  const setTimezone = api.user.setTimezone.useMutation();

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (!tz || localStorage.getItem("cp-tz") === tz) return;
        setTimezone.mutate(
          { timezone: tz },
          { onSuccess: () => localStorage.setItem("cp-tz", tz) },
        );
      } catch {
        // Intl/localStorage unavailable — silently skip.
      }
    }, 0);
    return () => clearTimeout(id);
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
