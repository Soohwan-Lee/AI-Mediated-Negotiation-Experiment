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
import { claimSlot } from "./assignment";
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

function newParticipantKey(): string {
  // Pseudonymous research key. The raw Prolific PID is stored separately so
  // exports can be de-identified (Methods §Data logging).
  return `P-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function ParticipantProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<ParticipantState>({
    participantKey: null,
    prolific: { prolificPid: null, studyId: null, sessionId: null },
    assignment: null,
    consented: false,
    ready: false,
  });

  // Restore prior session + capture Prolific params on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prolific: ProlificContext = {
      prolificPid: params.get("PROLIFIC_PID"),
      studyId: params.get("STUDY_ID"),
      sessionId: params.get("SESSION_ID"),
    };

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as {
        participantKey: string;
        prolific: ProlificContext;
        consented: boolean;
      };
      getStore()
        .loadAssignment(parsed.participantKey)
        .then((assignment) => {
          setState({
            participantKey: parsed.participantKey,
            // Fresh URL params win if present, otherwise keep what we stored.
            prolific: prolific.prolificPid ? prolific : parsed.prolific,
            assignment,
            consented: parsed.consented,
            ready: true,
          });
        });
      return;
    }

    setState((s) => ({ ...s, prolific, ready: true }));
  }, []);

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

  const value = useMemo(
    () => ({ ...state, beginStudy, logEvent, saveResponses }),
    [state, beginStudy, logEvent, saveResponses],
  );

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
