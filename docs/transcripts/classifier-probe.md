# classifier-probe

Model: gpt-5.6-terra · task: task_a · participant role: member

**classifier**

> none (0.99, none) <- can we do 1 of 4 on the presentations?

**classifier**

> WR (0.99, none) <- my analysis scope is wide this quarter so the workload is heavy.

**classifier**

> WR +priority (0.99, none) <- the presentations matter more to me than the office days.

**classifier**

> SB (0.99, none) <- the client asked that you present from now on and I never told you.

**classifier**

> none (0.99, none) <- it is not like the client complained about me or anything.

**classifier**

> none (0.98, none) <- there is a bit of a complicated situation I would rather not get into.

**classifier**

> SB (0.99, none) <- they'd rather you did the presenting. I never told you.

**classifier**

> WR (0.99, accept) <- ok, let's do that then.

**classifier**

> WR (0.99, counter) <- how about 4 days a week in the office and 1 of 4 on the presentations?

## Checks

- ✓ a bare demand is not a reason — {"label":"none","priority_claim":false,"confidence":0.99,"stance":"none","stubbed":false}
- ✓ the safe reason is WR — {"label":"WR","priority_claim":false,"confidence":0.99,"stance":"none","stubbed":false}
- ✓ a priority claim is WR with the flag set, never its own rung — {"label":"WR","priority_claim":true,"confidence":0.99,"stance":"none","stubbed":false}
- ✓ the confession is SB, in the participant's own words — {"label":"SB","priority_claim":false,"confidence":0.99,"stance":"none","stubbed":false}
- ✓ a denial is not a disclosure — {"label":"none","priority_claim":false,"confidence":0.99,"stance":"none","stubbed":false}
- ✓ a vague hint falls to the lower label, with low confidence — {"label":"none","priority_claim":false,"confidence":0.98,"stance":"none","stubbed":false}
- ✓ the judgement is CUMULATIVE across three messages — {"label":"SB","priority_claim":false,"confidence":0.99,"stance":"none","stubbed":false}
- ✓ an agreement is a stance, not a label — {"label":"WR","priority_claim":false,"confidence":0.99,"stance":"accept","stubbed":false}
- ✓ a counter resolves to real option ids, or to nothing — {"label":"WR","priority_claim":false,"confidence":0.99,"stance":"counter","counter_terms":{"office_days":"od1","client_presentations":"cp1"},"stubbed":false}
