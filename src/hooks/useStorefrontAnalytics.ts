import { startAnalyticsTracking, trackPageView } from "@/lib/analytics";
import { useEffect, useRef } from "react";

/** One view per route change, plus visibility-aware activity and click tracking. */
export function useStorefrontAnalytics(path: string): void {
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (lastPath.current !== path) {
      lastPath.current = path;
      trackPageView(path);
    }
  }, [path]);
  useEffect(() => startAnalyticsTracking(path), [path]);
}
