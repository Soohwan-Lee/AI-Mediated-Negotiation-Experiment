# AI-Mediated Negotiation Experiment

Online experiment platform for a study on AI proxies in workplace negotiation.
The negotiation flow and server-backed research storage are implemented.
Development/mock mode uses local browser storage; recruitment mode requires
Supabase and fails closed when its server configuration is unavailable.

## Run

```bash
npm install
npm run dev     # http://localhost:3000
```

Works with no API key — the counterpart falls back to canned text so the whole
flow is walkable.

## Environment

```bash
OPENAI_API_KEY=               # required for recruitment
OPENAI_MODEL=gpt-5.6-sol
NEXT_PUBLIC_DEV_TOOLS=off     # recruitment build; omit for local mock previews
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=          # server-only sb_secret_ key
# Alternatively: SUPABASE_SERVICE_ROLE_KEY=<legacy service-role JWT>
# Optional: STUDY_SESSION_SECRET=<separate cookie signing secret>
# Optional: PREFLIGHT_TOKEN=<private detailed readiness report token>
```

## Participant flow

Consent → Background → Instructions → Practice 1 → Task 1 → Task questionnaire
→ Bonus recommendation or upward evaluation → Open questions → Practice 2
→ Task 2 → Task questionnaire → Bonus recommendation or upward evaluation
→ Open questions → Final checks and comparison → Debriefing → Completion code

Each participant does one Direct session and one Proxy session (User-Specified
or AI-Supplemented), with task and order counterbalanced.

Open the study using Prolific's `PROLIFIC_PID`, `STUDY_ID`, and `SESSION_ID`
URL parameters. Production claims a preallocated slot on entry and stores a
signed HttpOnly session cookie; no Google login or Supabase Auth account is
required. The same Prolific participant and study retain their assignment.
Development/mock mode never calls the production slot allocator.

Apply the checked-in migration under `supabase/migrations` before using the
remote store. Its five tables keep slot allocation, participant/background/open
responses, coded task self-reports, task outcomes/metrics, and chat messages.
Only server credentials can access these tables. Never apply the historical
SQL in `docs/DATA_MODEL.md` as an additional schema.

Writes use an ordered queue scoped to the attempt UUID. Failed writes stay in
browser storage; old attempt queues are retained separately. There is no parallel
beacon transport. The completion page flushes pending writes and then asks the
server to verify all required saved analysis records and debrief acknowledgment.
An empty queue alone does not grant completion. An interrupted task is not resumed.

## Layout

```
src/lib/         types, study config, assignment, store, tasks
src/lib/ai/      prompts, structured-action schema, guardrail validator
src/app/api/     assign, persist, complete, counterpart, proxy-negotiation, preflight
src/app/         one directory per flow page
src/components/  shared UI and negotiation surfaces
docs/            data model and Supabase integration plan
```

See `CLAUDE.md` for design constraints. The checked-in Supabase migration is
the implemented schema; older design-model notes are historical.

## Deploy

Vercel. Set the environment variables above and rebuild with developer tools
off. Replace the Prolific completion code/URL in `src/lib/study-config.ts`
before recruitment. Check `/api/preflight?gate=1`; the detailed report uses
`/api/preflight?token=...`. These checks probe configuration/storage without
making a paid model request. Verify the deployed end-to-end save and completion
flow before releasing the Prolific study.
