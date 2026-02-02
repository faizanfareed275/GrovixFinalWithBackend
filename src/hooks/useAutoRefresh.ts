import { useEffect, useRef } from "react";

type UseAutoRefreshOptions = {
  enabled?: boolean;
  onRefresh: () => void;
  intervalMs?: number;
};

export function useAutoRefresh({ enabled = true, onRefresh, intervalMs }: UseAutoRefreshOptions) {
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    const refresh = () => {
      try {
        onRefreshRef.current();
      } catch {
      }
    };

    const onVisibility = () => {
      if (!document.hidden) refresh();
    };

    const onFocus = () => refresh();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    let t: number | null = null;
    if (typeof intervalMs === "number" && intervalMs > 0) {
      t = window.setInterval(refresh, intervalMs);
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      if (t) window.clearInterval(t);
    };
  }, [enabled, intervalMs]);
}
