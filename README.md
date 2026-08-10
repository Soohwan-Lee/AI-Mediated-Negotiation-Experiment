# AI-Mediated Negotiation Experiment

Online experiment platform for a study on AI proxies in workplace negotiation.
Scaffold stage: layout and flow are complete; task payoffs, the negotiation
state machine, and Supabase persistence are not yet wired.

## Run

```bash
npm install
npm run dev     # http://localhost:3000
```

Works with no API key — the counterpart falls back to canned text so the whole
flow is walkable.

## Environment

```bash
OPENAI_API_KEY=sk-...          # optional; without it, AI turns are stubbed
OPENAI_MODEL=gpt-5.6-sol       # optional; defaults to this
```

## Participant flow

Consent → Background → Instructions → Practice 1 → Session 1 → Practice 2 →
Session 2 → Questionnaire → Manipulation check → Reward decision →
Debriefing → Completion code

Each participant does one Direct session and one Proxy session (Delegate or
Explorer), with task and order counterbalanced. Assignment happens on entry
and is never shown to the participant.

## Layout

```
src/lib/         types, study config, assignment, store, tasks
src/lib/ai/      prompts, structured-action schema, guardrail validator
src/app/api/     assign, counterpart, proxy-negotiation
src/app/         one directory per flow page
src/components/  shared UI and negotiation surfaces
docs/            data model and Supabase integration plan
```

See `CLAUDE.md` for design constraints and `docs/DATA_MODEL.md` for the
planned schema.

## Deploy

Vercel. Set the environment variables above in project settings.
