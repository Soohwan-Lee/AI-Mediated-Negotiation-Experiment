"use client";

/**
 * Developer / mockup mode.
 *
 * PURPOSE: walk the entire flow without answering every item, without a real
 * slot claim, and without waiting on AI turns — so the layout and the
 * participant-facing sequence can be reviewed while the design is still
 * unsettled.
 *
 * DECEPTION INTEGRITY — READ BEFORE CHANGING:
 * The panel this powers names conditions ("Delegate", "Explorer"), reveals the
 * assignment, and jumps between pages. A participant must never see it
 * (CLAUDE.md §"Things the participant must never learn mid-study"). It is
 * therefore gated on a BUILD-TIME constant: the real Prolific build simply has
 * no toggle to find, rather than a hidden one. Keep it that way — do not
 * replace `DEV_TOOLS_AVAILABLE` with a runtime check.
 *
 *   next dev                      -> available
 *   NEXT_PUBLIC_DEV_TOOLS=1 build -> available (preview deploys)
 *   production build w/o that var -> compiled out
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
 * Build-time gate. Both operands are inlined by Next at compile time, so when
 * this is false the dev panel is dead code the bundler can drop.
 */
export const DEV_TOOLS_AVAILABLE =
  process.env.NEXT_PUBLIC_DEV_TOOLS === "1" ||
  process.env.NODE_ENV !== "production";

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
  /** Let "Continue" through with required items unanswered. */
  skipValidation: boolean;
  /** Answer AI turns locally and instantly instead of calling the route. */
  mockAi: boolean;
  /** Use `slot` instead of the claimed assignment. */
  slotOverride: boolean;
  slot: DevSlot;
}

const DEFAULTS: DevSettings = {
  enabled: DEV_TOOLS_AVAILABLE,
  skipValidation: true,
  mockAi: true,
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

/**
 * Registers a "Fill this page" handler while the calling page is mounted.
 * The handler may change identity every render; only the latest is called.
 */
export function useDevAutofill(fill: () => void) {
  const { registerAutofill, enabled } = useDevMode();
  const latest = useRef(fill);

  useEffect(() => {
    latest.current = fill;
  });

  useEffect(() => {
    if (!enabled) return;
    return registerAutofill(() => latest.current());
  }, [enabled, registerAutofill]);
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
