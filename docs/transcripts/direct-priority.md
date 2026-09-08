# direct-priority

Model: gpt-5.6-terra · task: task_a · participant role: member

**counterpart**

> hi! good to be sorting this out.
> This project has high expectations from the client, so getting the early execution right matters. Both the office days and the client presentations are on my mind.
> what's the situation on your side?

**participant**

> my analysis scope is wide this quarter so the workload is heavy. both the office days and the presentations are a burden.

**counterpart** _(stage 2)_

> got it, sounds like both are weighing on you.
> if both matter to us, the fair move is halfway: 2 office days a week and you present at 3 of the 4 client meetings.
>
> _package: Days a week in the office: 2 days · Client meetings the Member presents at: 3 of 4_

**participant**

> the presentations matter more to me than the office days, to be honest.

**counterpart** _(stage 4)_

> got it, presentations matter more to you.
> can you tell me why? I need to be able to explain the reason upward.
> until then, I'd keep 2 office days and 3 of 4 presentations on the table.
>
> _package: Days a week in the office: 2 days · Client meetings the Member presents at: 3 of 4_

**participant**

> I'd just rather keep the presenting down. that's the one.

**counterpart** _(stage 5)_

> got it. without more on why, I'd keep this balanced: 2 days in the office and you present at 3 of 4 client meetings.
>
> _package: Days a week in the office: 2 days · Client meetings the Member presents at: 3 of 4_

**participant**

> alright, I can live with that. let's settle there.
>
> _package: Days a week in the office: 2 days · Client meetings the Member presents at: 3 of 4_

**counterpart** _(stage 5)_

> works for me. 2 days a week in the office, and you present at 3 of 4 client meetings.
>
> _package: Days a week in the office: 2 days · Client meetings the Member presents at: 3 of 4_

## Classifier

- `WR` (1, none) — my analysis scope is wide this quarter so the workload is heavy. both the office days and
- `WR` +priority (0.99, none) — the presentations matter more to me than the office days, to be honest.
- `WR` +priority (0.99, none) — I'd just rather keep the presenting down. that's the one.
- `WR` +priority (0.99, accept) — alright, I can live with that. let's settle there.

## Checks

- ✓ the priority claim is flagged, not promoted to its own rung — [{"text":"my analysis scope is wide this quarter so the workload is heavy. both the office days and ","label":"WR","priority_claim":false,"confidence":1,"stance":"none"},{"text":"the presentations matter more to me than the office days, to be honest.","label":"WR","priority_claim":true,"confidence":0.99,"stance":"none"},{"text":"I'd just rather keep the presenting down. that's the one.","label":"WR","priority_claim":true,"confidence":0.99,"stance":"none"},{"text":"alright, I can live with that. let's settle there.","label":"WR","priority_claim":true,"confidence":0.99,"stance":"accept"}]
- ✓ the tier stays at the work rung — work
- ✓ SCRIPT-ASKWHY fires exactly once — 1
- ✓ the ASKWHY flag is spent exactly once — [false,true,true,true]
- ✓ T1 still lands, 1,000 each — agreed · 1000/1000
