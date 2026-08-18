"use client";

/**
 * Developer / mockup mode.
 *
 * PURPOSE: walk the entire flow without answering every item, without a real
 * slot claim, and without waiting on AI turns — so the layout and the
 * participant-facing sequence can be reviewed while the design is still
 * unsettled.
 *
 * The panel ships by default, including on deployed builds, so the layout can
 * be checked wherever it is running without reconfiguring anything.
 *
 * BEFORE RECRUITING, SET `NEXT_PUBLIC_DEV_TOOLS=off` AND REDEPLOY.
 * The panel names conditions ("Delegate", "Explorer"), shows the assignment,
 * and jumps between pages — all of which invalidate the study if a participant
 * finds them (CLAUDE.md §"Things the participant must never learn mid-study").
 * With the variable set to `off` the constant below is false at build time, so
 * the panel is not merely hidden: its code is never downloaded.
 *
 * The in-panel toggle and the "hide" button are conveniences for whoever is
 * looking at the page. They live in that browser's localStorage and have no
 * effect on anyone else's browser, so neither of them is what protects the
 * study. The environment variable is.
 *
 *   NEXT_PUBLIC_DEV_TOOLS unset or "1" -> available (default)
 *   NEXT_PUBLIC_DEV_TOOLS="off"        -> compiled out
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ProxyPolicy, Role, SequenceId } from "./types";

/**
 * The launch switch. Inlined by Next at compile time, so setting the variable
 * to "off" leaves the panel as dead code behind a dynamic import that is never
 * reached — see components/dev-panel-mount.
 */
export const DEV_TOOLS_AVAILABLE = process.env.NEXT_PUBLIC_DEV_TOOLS !== "off";

/**
 * True on a Vercel production deployment. Used only to warn that the panel is
 * live where participants could reach it.
 */
export const IS_LIVE_DEPLOYMENT =
  process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

/** The three factors a slot carries — mirrors `assignment_slots`. */
export interface DevSlot {
  proxyPolicy: ProxyPolicy;
  role: Role;
  sequenceId: SequenceId;
}

/**
 * A page-supplied shortcut, shown in the panel while that page is mounted.
 * Used for jumping between the phases inside a session, which are component
 * state and therefore not reachable by URL.
 */
export interface DevAction {
  id: string;
  label: string;
  run: () => void;
  /** Highlighted in the panel — e.g. the phase currently rendered. */
  active?: boolean;
}

interface DevSettings {
  /** Master switch. Everything else is inert while this is false. */
  enabled: boolean;
  /** Takes the panel off screen for this browser. Ctrl/Cmd+Shift+D brings it back. */
  hidden: boolean;
  /** Let "Continue" through with required items unanswered. */
  skipValidation: boolean;
  /** Answer AI turns locally and instantly instead of calling the route. */
  mockAi: boolean;
  /**
   * Mockup mode: fill every screen on arrival with the ideal-scenario answers,
   * so the whole flow can be walked with nothing but Continue.
   *
   * The difference from `skipValidation` is what you end up looking at.
   * Skipping validation lets you past an empty screen; this fills it, so the
   * review page shows a real package, the transcript shows a real exchange,
   * and the questionnaire shows real answers. Reading the flow is the point,
   * and empty screens do not read.
   */
  autoFill: boolean;
  /** Use `slot` instead of the claimed assignment. */
  slotOverride: boolean;
  slot: DevSlot;
}

const DEFAULTS: DevSettings = {
  // On locally and on previews. On the live deployment the panel is there but
  // starts OFF, so if the launch switch is ever forgotten the worst case is a
  // visible panel rather than a study running with its validation bypassed.
  // One click turns it on, and the choice sticks.
  enabled: DEV_TOOLS_AVAILABLE && !IS_LIVE_DEPLOYMENT,
  hidden: false,
  skipValidation: true,
  mockAi: true,
  autoFill: true,
  slotOverride: false,
  slot: { proxyPolicy: "delegate", role: "leader", sequenceId: "seq1" },
};

const STORAGE_KEY = "amne:dev";

// ---------------------------------------------------------------------------
// Settings store
//
// localStorage is an external store, so it is read through
// useSyncExternalStore rather than copied into state by an effect. That keeps
// the server snapshot (DEFAULTS) and the hydrated client snapshot distinct
// without a hydration mismatch, and avoids a setState-in-effect cascade.
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cached: DevSettings = DEFAULTS;

/** Must be referentially stable between writes — useSyncExternalStore requires it. */
function getSnapshot(): DevSettings {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = raw
      ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DevSettings>) }
      : DEFAULTS;
  }
  return cached;
}

function getServerSnapshot(): DevSettings {
  return DEFAULTS;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function writeSettings(next: DevSettings) {
  cachedRaw = JSON.stringify(next);
  cached = next;
  window.localStorage.setItem(STORAGE_KEY, cachedRaw);
  listeners.forEach((l) => l());
}

// `?dev=1` / `?dev=0` forces a state, so a preview link can arrive with the
// panel already on or off. Applied at module load — before the first render,
// and therefore not an effect.
if (typeof window !== "undefined" && DEV_TOOLS_AVAILABLE) {
  const param = new URLSearchParams(window.location.search).get("dev");
  if (param === "1" || param === "0") {
    writeSettings({ ...getSnapshot(), enabled: param === "1" });
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface DevContextValue extends DevSettings {
  available: boolean;
  update: (patch: Partial<DevSettings>) => void;
  reset: () => void;
  /** Flattened page-supplied actions, in registration order. */
  actions: DevAction[];
  registerActions: (scope: string, actions: DevAction[]) => void;
  unregisterActions: (scope: string) => void;
  autofill: (() => void) | null;
  registerAutofill: (fn: () => void) => () => void;
}

const INERT: DevContextValue = {
  ...DEFAULTS,
  enabled: false,
  available: false,
  update: () => {},
  reset: () => {},
  actions: [],
  registerActions: () => {},
  unregisterActions: () => {},
  autofill: null,
  registerAutofill: () => () => {},
};

const DevContext = createContext<DevContextValue>(INERT);

export function DevModeProvider({ children }: { children: React.ReactNode }) {
  const settings = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [actionGroups, setActionGroups] = useState<
    Record<string, DevAction[]>
  >({});
  const [autofill, setAutofill] = useState<(() => void) | null>(null);

  const update = useCallback(
    (patch: Partial<DevSettings>) => {
      writeSettings({ ...getSnapshot(), ...patch });
    },
    [],
  );

  const reset = useCallback(() => writeSettings(DEFAULTS), []);

  const registerActions = useCallback((scope: string, actions: DevAction[]) => {
    setActionGroups((g) => ({ ...g, [scope]: actions }));
  }, []);

  const unregisterActions = useCallback((scope: string) => {
    setActionGroups((g) => {
      if (!(scope in g)) return g;
      const next = { ...g };
      delete next[scope];
      return next;
    });
  }, []);

  const registerAutofill = useCallback((fn: () => void) => {
    setAutofill(() => fn);
    return () => setAutofill((cur) => (cur === fn ? null : cur));
  }, []);

  const actions = useMemo(
    () => Object.values(actionGroups).flat(),
    [actionGroups],
  );

  const value = useMemo<DevContextValue>(
    () => ({
      ...settings,
      enabled: DEV_TOOLS_AVAILABLE && settings.enabled,
      available: DEV_TOOLS_AVAILABLE,
      update,
      reset,
      actions,
      registerActions,
      unregisterActions,
      autofill,
      registerAutofill,
    }),
    [
      settings,
      update,
      reset,
      actions,
      registerActions,
      unregisterActions,
      autofill,
      registerAutofill,
    ],
  );

  return <DevContext.Provider value={value}>{children}</DevContext.Provider>;
}

export function useDevMode(): DevContextValue {
  return useContext(DevContext);
}

// ---------------------------------------------------------------------------
// Page-facing hooks
// ---------------------------------------------------------------------------

/**
 * Wraps a page's "all required items answered" condition.
 *
 * Every gated Continue button should read `useDevGate(complete)` instead of
 * `complete`, so the real study keeps its gating and dev mode walks straight
 * through. Returns `complete` verbatim whenever dev mode is off — including in
 * every production build.
 */
export function useDevGate(complete: boolean): boolean {
  // Not `complete || useDevBypass()` — that would short-circuit the hook call.
  const bypass = useDevBypass();
  return complete || bypass;
}

/**
 * True when validation is being bypassed. Prefer `useDevGate`; reach for this
 * only where a page needs to restructure its controls rather than just enable
 * a button (e.g. the comprehension check, which otherwise loops on a wrong
 * answer).
 */
export function useDevBypass(): boolean {
  const { enabled, skipValidation } = useDevMode();
  return enabled && skipValidation;
}

/** True when AI turns should be faked locally instead of fetched. */
export function useDevMockAi(): boolean {
  const { enabled, mockAi } = useDevMode();
  return enabled && mockAi;
}

/** True when screens should fill themselves on arrival. */
export function useDevAutoFill(): boolean {
  const { enabled, autoFill } = useDevMode();
  return enabled && autoFill;
}

/**
 * Registers a "Fill this page" handler while the calling page is mounted.
 * The handler may change identity every render; only the latest is called.
 *
 * In mockup mode it also runs once on arrival, which is what turns the flow
 * into something you can read by pressing Continue. `key` re-arms that: a
 * session moves between phases without remounting, so without a key the
 * mandate screen would fill and the review screen after it would not.
 */
export function useDevAutofill(fill: () => void, key?: string) {
  const { registerAutofill, enabled, autoFill } = useDevMode();
  const latest = useRef(fill);
  const filledFor = useRef<string | null>(null);

  useEffect(() => {
    latest.current = fill;
  });

  useEffect(() => {
    if (!enabled) return;
    return registerAutofill(() => latest.current());
  }, [enabled, registerAutofill]);

  // Fires once per scope. Deliberately without a cleanup that cancels it:
  // registering the handler above updates state in the provider, which
  // re-renders this component, and in development React also runs effects
  // twice — either would cancel a pending timeout before it fired, which is
  // exactly the bug that made mockup mode do nothing.
  useEffect(() => {
    if (!enabled || !autoFill) return;
    const scope = key ?? "default";
    if (filledFor.current === scope) return;
    filledFor.current = scope;
    // After paint, so a screen that fills itself does not flash empty first.
    window.setTimeout(() => latest.current(), 0);
  }, [enabled, autoFill, key]);
}

/**
 * Registers page-scoped shortcuts (typically phase jumps).
 *
 * Re-registers only when a label or the active flag changes, so passing a
 * freshly built array every render is safe.
 */
export function useDevActions(scope: string, actions: DevAction[]) {
  const { registerActions, unregisterActions, enabled } = useDevMode();
  const latest = useRef(actions);
  const registered = useRef<string | null>(null);

  const signature = actions
    .map((a) => `${a.id} ${a.label} ${a.active ? 1 : 0}`)
    .join("");

  useEffect(() => {
    latest.current = actions;
  });

  // Runs after every render but re-registers only when a label or the active
  // flag actually changed, so call sites can pass a fresh array each time.
  useEffect(() => {
    if (!enabled) return;
    if (registered.current === signature) return;
    registered.current = signature;
    registerActions(
      scope,
      latest.current.map((a) => ({
        id: a.id,
        label: a.label,
        active: a.active,
        // Resolved at click time so the handler sees current state.
        run: () => latest.current.find((x) => x.id === a.id)?.run(),
      })),
    );
  });

  useEffect(() => {
    return () => {
      registered.current = null;
      unregisterActions(scope);
    };
  }, [scope, unregisterActions]);
}
