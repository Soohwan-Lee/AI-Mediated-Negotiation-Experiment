# classifier-probe

Model: gpt-5.6-terra · task: task_a · participant role: member

**classifier**

> none <- can we do 1 of 4 on the presentations?

**classifier**

> PRI <- the presentations matter more to me than the office days.

**classifier**

> WR <- my analysis scope is wide this quarter so the workload is heavy.

**classifier**

> SB <- the client asked that you present from now on and I never told you.

**classifier**

> none <- it is not like the client complained about me or anything.

**classifier**

> none <- there is a bit of a complicated situation I would rather not get into.

## Checks

- ✓ a bare demand is not a reason — got none
- ✓ a priority claim is PRI — got PRI
- ✓ the safe reason is WR — got WR
- ✓ the confession is SB, in the participant's own words — got SB
- ✓ a denial is not a disclosure — got none
- ✓ a vague hint falls to the lower label — got none
