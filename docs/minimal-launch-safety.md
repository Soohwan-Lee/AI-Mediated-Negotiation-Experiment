# Minimal launch-safety boundary

Historical implementation/QA note: the pre-backend storage description below
is superseded by the remote implementation and verification record in
[`SUPABASE_SETUP.md`](SUPABASE_SETUP.md). Preserve this section as the earlier
safety-boundary rationale, not the current backend setup instructions.

This pass adds the smallest task-interruption, Proxy-turn retry, and completion
durability boundaries that can be implemented before the study backend is
connected. It does not add full task resume or recovery.

- `Store.confirmSaved()` must succeed before the completion event is written.
- The completion event is idempotent and must itself be confirmed before the
  Prolific code appears.
- A withdrawal, technical stop, or active/interrupted task hides the code.
- Local storage failures retain the newest value per key for reads and Retry.
- Repeated transcript writes with one stable message ID merge later metadata;
  distinct IDs remain distinct messages.
- Participant copy distinguishes data saved in this browser from data saved to
  a research server.

Task and turn boundaries:

- Each task records `active`, `completed`, or `interrupted` per participant and
  task. Refreshing or re-entering an active negotiation marks it interrupted and
  routes to a technical stop; reopening a task before negotiation starts still
  permits rereading its briefing. Developer mode bypasses this launch guard.
- Proxy-turn requests retry a bounded number of times. A retry keeps the already
  stored transcript prefix, reuses the same turn index, and ignores stale or
  aborted responses rather than appending a second copy. Exhausted retries end
  in the same immediate technical-stop path; there is no full negotiation
  recovery in this pass.

Verified QA for this pass:

- The full unit suite passed: 432/432 tests.
- The production build passed.
- In an isolated browser, a Direct pre-start reload created no task-run marker;
  reloading after the negotiation became active marked the same assignment as
  interrupted.
- In an injected Proxy run, turn 0 succeeded and turn 1 returned 503;
  request turn indices were `[0, 1, 1, 1]`, only one stored prefix message
  remained, and the flow immediately reached the technical-stop screen after
  bounded retries.
- With an injected local-storage write failure, the completion code stayed
  hidden. After storage recovered, Retry revealed the code and the participant
  had exactly one completion event.

These are deterministic test and fault-injection results. They do not claim a
successful real model call, Supabase connection, or production network load.

Before recruitment, still required:

- Connect and verify the dormant remote Store and its server persistence route.
- Apply and review the Supabase schema, RLS, idempotency, and atomic assignment
  claim. This pass does not create or enable any Supabase connection.
- Disable developer tools in the production build and run the full launch
  preflight and browser flow.
- Decide the minimal analysis tables and exports. Existing IC answers, events,
  and local records remain untouched, but they are not automatically part of a
  future minimal analysis database.

`persistenceKind: "local"` confirms browser-device storage only. It is not a
claim of server durability, cross-device recovery, or researcher access.
