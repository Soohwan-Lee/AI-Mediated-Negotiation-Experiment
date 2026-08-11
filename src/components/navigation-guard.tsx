"use client";

/**
 * Forward-only navigation.
 *
 * Participants do try to go back — to re-read instructions, to change an
 * answer, or by reflex. Any of those corrupts the data: responses are already
 * written, the initial-preference measures are baselines that must be taken
 * before the counterpart is seen, and re-entering a session would restart it.
 *
 * The back press is absorbed rather than undone: a sentinel history entry is
 * pushed on every screen, and a back press consumes it and pushes another. The
 * participant stays put, which matters because a session's phase lives in
 * component state — bouncing them forward afterwards would restart the
 * negotiation they were in the middle of.
 *
 * A recorded furthest step backs this up for bookmarks and hand-typed URLs,
 * where there is no back press to absorb.
 *
 * Inert while dev mode is on — the dev panel navigates freely by design.
 */

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDevMode } from "@/lib/dev-mode";
import { readFurthest, writeFurthest } from "@/lib/flow-position";
import { FLOW, flowIndex, flowKeyFromPath } from "@/lib/study-config";

export function NavigationGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { enabled: devEnabled } = useDevMode();
  const [notice, setNotice] = useState(false);

  const key = flowKeyFromPath(pathname ?? "");

  // Absorb the back press. Pushing from inside the popstate handler keeps the
  // sentinel in place for the next one, so back never leaves the screen.
  useEffect(() => {
    if (devEnabled || !key) return;

    window.history.pushState(null, "", window.location.href);

    function onPopState() {
      window.history.pushState(null, "", window.location.href);
      setNotice(true);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [devEnabled, key]);

  // Backstop for arrivals with no back press to absorb: a bookmark, a typed
  // URL, or a browser that navigated anyway.
  useEffect(() => {
    if (devEnabled || !key) return;

    const index = flowIndex(key);
    const furthest = readFurthest();

    if (index >= furthest) {
      writeFurthest(index);
      return;
    }

    // Below the mark and not put here by the Back control, which lowers the
    // mark before navigating. So: a bookmark, a typed URL, or a back press the
    // sentinel did not catch.
    router.replace(FLOW[furthest].href);
  }, [devEnabled, key, router]);

  // Warn on reload and on closing the tab, everywhere except the final page.
  useEffect(() => {
    if (devEnabled || !key || key === "complete") return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [devEnabled, key]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(false), 7000);
    return () => window.clearTimeout(id);
  }, [notice]);

  if (!notice) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-[var(--header-h)] z-40 flex justify-center px-4 pt-3"
    >
      <p className="max-w-md rounded-[var(--radius)] border border-[#f0dcc0] bg-[var(--caution-soft)] px-4 py-2.5 text-center text-sm text-[#6d3d05] shadow-sm">
        This study only moves forward, so the back button is turned off. Your
        answers are saved as you go.
      </p>
    </div>
  );
}
