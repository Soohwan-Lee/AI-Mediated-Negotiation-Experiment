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
} from "react";
import { claimSlot, resolveAssignment } from "./assignment";
import { useDevMode } from "./dev-mode";
import { getStore } from "./store";
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
  ready: boolean;
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
const DEV_PARTICIPANT_KEY = "P-devpreview";
const DEV_ASSIGNED_AT = "1970-01-01T00:00:00.000Z";

function newParticipantKey(): string {
  // Pseudonymous research key. The raw Prolific PID is stored separately so
  // exports can be de-identified (Methods §Data logging).
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
      ready: false,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const urlProlific: ProlificContext = {
    prolificPid: params.get("PROLIFIC_PID"),
    studyId: params.get("STUDY_ID"),
    sessionId: params.get("SESSION_ID"),
  };

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return {
      participantKey: null,
      prolific: urlProlific,
      assignment: null,
      consented: false,
      ready: true,
    };
  }

  const parsed = JSON.parse(stored) as {
    participantKey: string;
    prolific: ProlificContext;
    consented: boolean;
  };

  return {
    participantKey: parsed.participantKey,
    // Fresh URL params win if present, otherwise keep what we stored.
    prolific: urlProlific.prolificPid ? urlProlific : parsed.prolific,
    // Loaded asynchronously below.
    assignment: null,
    consented: parsed.consented,
    ready: true,
  };
}

export function ParticipantProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<ParticipantState>(readInitialState);
  const dev = useDevMode();

  // Rehydrate the assignment for a returning participant. This is a genuine
  // external-store read, so it belongs in an effect.
  const restoredKey = state.participantKey;
  useEffect(() => {
    if (!restoredKey) return;
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
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          participantKey: next.participantKey,
          prolific: next.prolific,
          consented: next.consented,
        }),
      );
    },
    [],
  );

  const beginStudy = useCallback(async () => {
    const store = getStore();
    const participantKey = state.participantKey ?? newParticipantKey();

    await store.createParticipant(participantKey, state.prolific);

    // TODO(supabase): this becomes a POST to /api/assign so the slot claim is
    // atomic and server-authoritative.
    const existing = await store.loadAssignment(participantKey);
    const assignment = existing ?? (await claimSlot(participantKey));
    if (!existing) await store.saveAssignment(assignment);

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
  }, [persist, state.participantKey, state.prolific]);

  const logEvent = useCallback<ParticipantContextValue["logEvent"]>(
    (type, payload, extra) => {
      if (!state.participantKey) return;
      void getStore().logEvent({
        type,
        participantKey: state.participantKey,
        page: extra?.page,
        sessionIndex: extra?.sessionIndex,
        payload,
        clientTimestamp: new Date().toISOString(),
      });
    },
    [state.participantKey],
  );

  const saveResponses = useCallback(
    async (block: string, responses: SurveyResponses) => {
      if (!state.participantKey) return;
      await getStore().saveResponses(state.participantKey, block, responses);
      logEvent("survey_saved", { block });
    },
    [logEvent, state.participantKey],
  );

  /**
   * In dev mode the panel's slot can stand in for a claimed one, so a session
   * page opened directly — without consenting first — still has something to
   * render, and so both proxy policies and both roles can be previewed without
   * clearing storage. Off in production: `dev.enabled` is a build-time false.
   */
  const useDevSlot = dev.enabled && (dev.slotOverride || !state.assignment);
  const assignment = useMemo(() => {
    if (!useDevSlot) return state.assignment;
    return resolveAssignment(
      state.participantKey ?? DEV_PARTICIPANT_KEY,
      dev.slot,
      DEV_ASSIGNED_AT,
    );
  }, [useDevSlot, state.assignment, state.participantKey, dev.slot]);

  const value = useMemo(
    () => ({ ...state, assignment, beginStudy, logEvent, saveResponses }),
    [state, assignment, beginStudy, logEvent, saveResponses],
  );

  // The initial state is read from localStorage + URL params, which do not
  // exist during SSR. Rendering children only after mount keeps the server and
  // first client paint identical and avoids a hydration mismatch.
  if (!state.ready) {
    return (
      <ParticipantContext.Provider value={value}>
        <div
          aria-busy="true"
          className="flex min-h-screen items-center justify-center text-sm text-neutral-500"
        >
          Loading…
        </div>
      </ParticipantContext.Provider>
    );
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
