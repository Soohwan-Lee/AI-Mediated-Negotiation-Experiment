"use client";

/**
 * Mount point for the developer panel.
 *
 * The panel is loaded through a dynamic import so a production build never
 * fetches its chunk: `DEV_TOOLS_AVAILABLE` is a build-time constant, so when it
 * is false the import below is never reached and the participant's browser
 * never downloads the code that names conditions. Importing `DevPanel`
 * statically anywhere would undo that — keep this indirection.
 */

import dynamic from "next/dynamic";
import { DEV_TOOLS_AVAILABLE } from "@/lib/dev-mode";

const DevPanel = dynamic(
  () => import("./dev-panel").then((m) => m.DevPanel),
  { ssr: false },
);

export function DevPanelMount() {
  if (!DEV_TOOLS_AVAILABLE) return null;
  return <DevPanel />;
}
