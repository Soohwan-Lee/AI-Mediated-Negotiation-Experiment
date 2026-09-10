"use client";

/**
 * Participant session context.
 *
 * Holds the pseudonymous participant key, the Prolific URL parameters, and the
 * resolved assignment. Persists to localStorage so a refresh mid-study does not
 * lose the assignment (Methods §Experimental assignment: "Assignment is not
 * changed after session start").
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  DEV_PARTICIPANT_KEY,
  claimSlot,
  participantKeyForDevSlot,
  resolveAssignment,
} from "./assignment";
import { useDevMode } from "./dev-mode";
import { getStore, REMOTE_STUDY, setStoreIdentity } from "./store";
import { requestAdmission } from "./admission";
import type {
  Assignment,
  EventType,
  ProlificContext,
  SurveyResponses,
} from "./types";

interface ParticipantState {
  participantKey: string | null;
  prolific: ProlificContext;
  assignment: Assignment | null;
  consented: boolean;
}

interface ParticipantContextValue extends ParticipantState {
  /** Called on the consent page. Creates the participant and claims a slot. */
  beginStudy: () => Promise<Assignment>;
  logEvent: (
    type: EventType,
    payload?: Record<string, unknown>,
    extra?: { page?: string; sessionIndex?: 1 | 2 },
  ) => void;
  saveResponses: (block: string, responses: SurveyResponses) => Promise<void>;
}

const ParticipantContext = createContext<ParticipantContextValue | null>(null);

const STORAGE_KEY = "amne:session";

/**
 * Stand-in identity and timestamp for a dev-mode assignment. Fixed values, so
 * a synthesized assignment keeps a stable object identity across renders.
 */
const DEV_ASSIGNED_AT = "1970-01-01T00:00:00.000Z";

/**
 * "Has the client taken over yet?", without a hydration mismatch.
 *
 * The session state comes from localStorage and URL params, neither of which
 * exists on the server, so children cannot be rendered until the client is
 * running. Reading that as ordinary state makes the FIRST client render
 * differ from the server's and React throws the tree away; useSyncExternalStore
 * is the supported way to say "server said false, client says true" without a
 * mismatch.
 */
const NEVER_CHANGES = () => () => {};

function useHydrated(): boolean {
  return useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false,
  );
}

function newParticipantKey(): string {
  // Pseudonymous research key. The raw Prolific PID is stored separately so
  // exports can be de-identified (Methods §Data logging).
  //
  // `randomUUID` where the browser has it: the fallback draws about 40 bits
  // from `Math.random`, which is not a collision guarantee across 120
  // participants' worth of keys and is not required to be unpredictable. The
  // fallback stays for the non-secure contexts that have no `crypto` at all.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `P-${crypto.randomUUID()}`;
  }
  return `P-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/**
 * Reads the browser-only session sources (URL params + localStorage). Called
 * lazily from useState so it runs once on the client without an effect.
 * Returns the server-safe empty state during SSR.
 */
function readInitialState(): ParticipantState {
  if (typeof window === "undefined") {
    return {
      participantKey: null,
      prolific: { prolificPid: null, studyId: null, sessionId: null },
      assignment: null,
      consented: false,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const urlProlific: ProlificContext = {
    prolificPid: params.get("PROLIFIC_PID"),
    studyId: params.get("STUDY_ID"),
    sessionId: params.get("SESSION_ID"),
  };

  let stored: string | null = null;
  try { stored = window.localStorage.getItem(STORAGE_KEY); } catch { /* Server identity can still restore. */ }
  if (!stored) {
    return {
      participantKey: null,
      prolific: urlProlific,
      assignment: null,
      consented: false,
    };
  }

  let parsed: {
    participantKey: string;
    prolific: ProlificContext;
    consented: boolean;
  };
  try { parsed = JSON.parse(stored); } catch {
    return { participantKey: null, prolific: urlProlific, assignment: null, consented: false };
  }
  const changed = Boolean(urlProlific.prolificPid &&
    (urlProlific.prolificPid !== parsed.prolific?.prolificPid || urlProlific.studyId !== parsed.prolific?.studyId));

  return {
    participantKey: changed || REMOTE_STUDY ? null : parsed.participantKey,
    // Fresh URL params win if present, otherwise keep what we stored.
    prolific: REMOTE_STUDY ? urlProlific : urlProlific.prolificPid ? urlProlific : parsed.prolific,
    // Loaded asynchronously below.
    assignment: null,
    consented: changed || REMOTE_STUDY ? false : parsed.consented,
  };
}

export function ParticipantProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<ParticipantState>(readInitialState);
  const hydrated = useHydrated();
  const dev = useDevMode();
  const [admission, setAdmission] = useState<"pending" | "ready" | "failed">(REMOTE_STUDY ? "pending" : "ready");
  const [admissionError, setAdmissionError] = useState("");
  const [admissionRetry, setAdmissionRetry] = useState(0);

  useEffect(() => {
    if (!REMOTE_STUDY) return;
    let cancelled = false;
    void requestAdmission(state.prolific).then((result) => {
      if (cancelled) return;
      setStoreIdentity(result.assignment.participantKey);
      setState(s => ({ ...s, participantKey: result.assignment.participantKey,
        assignment: result.assignment, consented: result.consented === true }));
      setAdmission("ready");
      if (result.status === "completed" && window.location.pathname !== "/complete") window.location.replace("/complete");
    }).catch((error: unknown) => {
      if (cancelled) return;
      setAdmissionError(error instanceof Error ? error.message : "Unable to start the study.");
      setAdmission("failed");
    });
    return () => { cancelled = true; };
  }, [admissionRetry, state.prolific]);
  const useDevSlot = dev.enabled && (dev.slotOverride || !state.assignment);
  const effectiveParticipantKey = participantKeyForDevSlot(
    state.participantKey,
    useDevSlot,
  );

  // Rehydrate the assignment for a returning participant. This is a genuine
  // external-store read, so it belongs in an effect.
  const restoredKey = state.participantKey;
  useEffect(() => {
    if (!restoredKey || REMOTE_STUDY) return;
    let cancelled = false;
    void getStore()
      .loadAssignment(restoredKey)
      .then((assignment) => {
        if (cancelled || !assignment) return;
        setState((s) =>
          s.assignment ? s : { ...s, assignment },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [restoredKey]);

  const persist = useCallback(
    (next: Pick<ParticipantState, "participantKey" | "prolific" | "consented">) => {
      try { window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          participantKey: next.participantKey,
          prolific: next.prolific,
          consented: next.consented,
        }),
      ); } catch { if (!REMOTE_STUDY) throw new Error("Browser storage is unavailable"); }
    },
    [],
  );

  const beginStudy = useCallback(async () => {
    const store = getStore();
    if (REMOTE_STUDY) {
      if (admission !== "ready" || !state.assignment || !state.participantKey) throw new Error("Study admission is not ready");
      await store.createParticipant(state.participantKey, state.prolific);
      if (!(await store.confirmSaved())) throw new Error("Consent could not be saved");
      persist({ participantKey: state.participantKey, prolific: state.prolific, consented: true });
      setState(s => ({ ...s, consented: true }));
      return state.assignment;
    }
    const participantKey = state.participantKey ?? newParticipantKey();

    await store.createParticipant(participantKey, state.prolific);

    // Local previews retain their deterministic assignment without touching
    // the production allocator. Production admission already happened above.
    const existing = await store.loadAssignment(participantKey);
    let assignment = existing;
    if (!assignment) {
      assignment = await claimSlot(participantKey);
      await store.saveAssignment(assignment);
    }

    await store.logEvent({
      type: "assignment_created",
      participantKey,
      payload: {
        proxyPolicy: assignment.proxyPolicy,
        role: assignment.role,
        sequenceId: assignment.sequenceId,
      },
      clientTimestamp: new Date().toISOString(),
    });

    persist({ participantKey, prolific: state.prolific, consented: true });
    setState((s) => ({ ...s, participantKey, assignment, consented: true }));
    return assignment;
  }, [admission, persist, state.assignment, state.participantKey, state.prolific]);

  const logEvent = useCallback<ParticipantContextValue["logEvent"]>(
    (type, payload, extra) => {
      if (!effectiveParticipantKey) return;
      void getStore().logEvent({
        type,
        participantKey: effectiveParticipantKey,
        page: extra?.page,
        sessionIndex: extra?.sessionIndex,
        payload,
        clientTimestamp: new Date().toISOString(),
      });
    },
    [effectiveParticipantKey],
  );

  const saveResponses = useCallback(
    async (block: string, responses: SurveyResponses) => {
      if (!effectiveParticipantKey) return;
      await getStore().saveResponses(effectiveParticipantKey, block, responses);
      logEvent("survey_saved", { block });
    },
    [effectiveParticipantKey, logEvent],
  );

  /**
   * In dev mode the panel's slot can stand in for a claimed one, so a session
   * page opened directly — without consenting first — still has something to
   * render, and so both proxy policies and both roles can be previewed without
   * clearing storage. Off in production: `dev.enabled` is a build-time false.
   */
  const assignment = useMemo(() => {
    if (!useDevSlot) return state.assignment;
    return resolveAssignment(
      effectiveParticipantKey ?? DEV_PARTICIPANT_KEY,
      dev.slot,
      DEV_ASSIGNED_AT,
    );
  }, [useDevSlot, state.assignment, effectiveParticipantKey, dev.slot]);

  const value = useMemo(
    () => ({
      ...state,
      participantKey: effectiveParticipantKey,
      assignment,
      beginStudy,
      logEvent,
      saveResponses,
    }),
    [state, effectiveParticipantKey, assignment, beginStudy, logEvent, saveResponses],
  );

  // Children need localStorage and URL params, so they wait for the client.
  // `hydrated` is false during the server render AND during the hydrating
  // render, which is what keeps the two identical — see useHydrated.
  if (!hydrated || admission === "pending") {
    return (
      <ParticipantContext.Provider value={value}>
        <div
          aria-busy="true"
          className="flex min-h-screen items-center justify-center text-sm text-[var(--ink-3)]"
        >
          Loading…
        </div>
      </ParticipantContext.Provider>
    );
  }

  if (admission === "failed") {
    return <main className="mx-auto max-w-xl p-8 text-center">
      <h1 className="text-xl font-semibold">The study is not available yet</h1>
      <p className="my-4">{admissionError}</p>
      <button type="button" onClick={() => { setAdmission("pending"); setAdmissionRetry(n => n + 1); }}
        className="rounded-lg border px-5 py-3">Try again</button>
    </main>;
  }

  return (
    <ParticipantContext.Provider value={value}>
      {children}
    </ParticipantContext.Provider>
  );
}

export function useParticipant(): ParticipantContextValue {
  const ctx = useContext(ParticipantContext);
  if (!ctx) {
    throw new Error("useParticipant must be used inside <ParticipantProvider>");
  }
  return ctx;
}

/** Logs page entry once on mount. */
export function usePageEnter(page: string) {
  const { logEvent, participantKey } = useParticipant();
  useEffect(() => {
    if (participantKey) logEvent("page_enter", undefined, { page });
  }, [logEvent, page, participantKey]);
}
