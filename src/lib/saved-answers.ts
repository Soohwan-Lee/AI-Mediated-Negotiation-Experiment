"use client";

/**
 * Brings a page's saved answers back when a participant returns to it.
 *
 * Without this, Back is a trap: the participant goes back to change one thing
 * and finds the screen blank. Answers are read from the same store, under the
 * same participant key and block name they were written with, so what comes
 * back is that participant's own work and a change overwrites it in place
 * rather than creating a second record.
 *
 * Local edits win over the stored copy, so a slow read cannot overwrite
 * something typed while it was in flight.
 */

import { useEffect, useRef } from "react";
import { useParticipant } from "./participant-context";
import { getStore } from "./store";
import type { SurveyResponses } from "./types";

export function useRestoreAnswers(
  block: string,
  onRestore: (saved: SurveyResponses) => void,
) {
  const { participantKey } = useParticipant();

  const latest = useRef(onRestore);
  useEffect(() => {
    latest.current = onRestore;
  });

  useEffect(() => {
    if (!participantKey) return;
    let cancelled = false;

    void getStore()
      .loadResponses(participantKey, block)
      .then((saved) => {
        if (cancelled || !saved || Object.keys(saved).length === 0) return;
        latest.current(saved);
      });

    return () => {
      cancelled = true;
    };
  }, [participantKey, block]);
}
