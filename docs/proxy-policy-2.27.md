# Proxy wording and supplementary arguments

2026-09-10. Policy alignment with Experimental Design Ver.2.27, sections 6.5–6.7 and 8.7, and the clarified known-policy, unmarked sentence-level provenance manipulation. This document supersedes older descriptions of explicit source transitions, fixed task-by-role pairs, or factual omissions. It does not change the experimental structure.

- Both policies use identical, fixed, work-focused phrasing in `PROXY_REASON_BASES`. Original reason cards and Direct wording stay unchanged. Facts about who acted, private delivery, and non-disclosure are preserved.
- Each task and role has three arguments in `PROXY_WORK_BENEFITS`: WR1 explains a possible benefit of clarifying Issue 1, and WR2 does the same for Issue 2. Together they explain why both arrangements matter without ranking them or demanding a direction. SB1 supports the focal request explained by authorized SB. WR-only uses WR1 + WR2. Authorized SB uses WR1 + SB1, so WR1 remains relevant on both paths.
- Under AI-Supplemented, each Proxy adds exactly two arguments once, with no source label or separator. The participant Proxy uses its first reason turn. The counterpart uses opening on WR-only, or reciprocal SB disclosure on the SB path. No additional turn or later refusal argument is added. User-Specified adds no arguments.
- Both policies format the entire utterance with the same sentence-boundary, length-based bubble splitting. Factual bases and additions do not receive separate formatting, colors, or sections. The base remains first, followed by the fixed pair; there is no randomized blending. Removing explicit labels does not guarantee that participants cannot infer a sentence's source or that factual origins are hidden.
- The server-controlled renderer selects the pair from the designated card layer. The LLM cannot choose a different pair or rewrite the factual base. Added arguments do not count as SB or change the score.
- Participant instructions explain the shared bilateral policy, reformulation, and information-dependent supplementation without identifying particular sentences as AI-generated or promising protection, greater persuasion, or a better outcome. The leave illustration is separate from the neutral practice. Later human replies must not invent sentence-level provenance from the observed exchange. Hidden research provenance remains in structured audit metadata, not spoken text.

Unchanged: conditions, assignments, original cards, eight shared factual bases, four SB1 arguments, task points, reciprocal SB gate, seven-turn protocol, direct confirmation, quantitative measures, timers, and payment. The eight WR arguments and qualitative instrument are updated below. This local update does not deploy the application or authorize recruitment.

## Task reflection instrument: 2.27-open-v3

### Revised fixed WR arguments

| Task / role | WR1: Issue 1 | WR2: Issue 2 |
|---|---|---|
| task_a / leader | Knowing the office schedule could help the team plan joint reviews of materials before client meetings. | Clear presentation responsibilities could also help the team prepare consistent messages for the client. |
| task_a / member | Knowing the office schedule could help the Member plan analysis work around commuting and meetings. | Clear presentation responsibilities could also help the Member set aside preparation time without disrupting other work. |
| task_b / leader | Knowing the project-day allocation could help the team set realistic weekly milestones. | Clear reporting responsibilities could also help turn project progress into timely client updates. |
| task_b / member | Knowing the project-day commitment could help the Member reserve time for existing deadlines. | Clear reporting responsibilities could also help the Member fit report preparation around other work. |

Each task's reflection follows its experience ratings and BR1/FE1 decision, on one page. Six common required questions are grouped into choices/reactions, impressions/outcome, and workplace reflection. Four further required questions in the Proxy task cover representation and involvement, responsibility for one's own Proxy's reasons, the perceived sources of the other Proxy's reasons, and responsibility for those other-side reasons. Both Proxy policies receive identical questions. OEC1 follows Task 2's questions on that same page, before optional OET1; it is not repeated in the final checks. ICC3 remains with study-wide checks, and existing post-debrief comments are unchanged.

The instrument requires 17 task-reflection responses across the study (six in Direct, ten in Proxy, and one comparison), plus two optional OET1 entries. Required means nonempty, not a word minimum. Probes are optional and need no separate answer. The data identifier is `2.27-open-v3`, not a new design-document version. Records started under `2.27-open-v2` retain that version's separate OEP1 representation and OEP2 control questions and do not receive OEP5; earlier records retain their original instrument and wording.

These self-constructed questions seek explanations, concrete experiences, and contrary or no-difference accounts. They do not presume disclosure, counterpart SB, harm, lost control, AI authorship, or a protective result. Qualitative accounts contextualize quantitative findings; they do not turn nonsignificance into evidence of an effect. This is a written open-ended survey, not an interactive interview or a claim of thematic saturation. Pilot timing must check the expanded burden before recruitment; the current time and payment settings are not changed here.

### Current question catalog

English is participant-facing; Korean is a researcher translation. OED1/OEI1/OEF1/OEE1/OEN1/OER1 are asked after each task; OEP1/OEP3/OEP4/OEP5 only after the Proxy task; OEC1 only after Task 2. OET1 is optional after each task.

**OED1**

- EN: At the start, how did you decide what background to share or keep private, and why?
- KO: 처음에 어떤 배경을 공유하거나 비공개로 둘지 어떻게 결정했으며, 왜 그렇게 결정했습니까?
- Optional prompt: What did you expect sharing or withholding it might change, including any benefits or concerns?

**OEI1**

- EN: Did anything during the negotiation change what you wanted to share or how you wanted to proceed? Why or why not?
- KO: 협상 중 공유하고 싶은 내용이나 진행 방식을 바꾼 일이 있었습니까? 바뀌었거나 그대로였던 이유는 무엇입니까?
- Optional prompt: You can describe a particular message or moment, or explain why your approach stayed the same.

**OEF1**

- EN: How did you feel when your reasons were conveyed or kept private, and why?
- KO: 내 이유가 전달되거나 비공개로 남았을 때 어떤 기분이었으며, 왜 그랬습니까?
- Optional prompt: What, if anything, did the other person's response mean to you personally?

**OEE1**

- EN: What impression did you form of the counterpart, and which messages or actions led you to that impression?
- KO: 상대방에 대해 어떤 인상을 받았으며, 어떤 말이나 행동 때문에 그렇게 느꼈습니까?
- Optional prompt: If relevant, explain how that impression related to your bonus recommendation (Leader) or evaluation of the Leader (Member).

**OEN1**

- EN: How did you feel about the negotiation process and how the task ended, and why?
- KO: 협상 과정과 과제가 끝난 방식에 대해 어떤 기분이었으며, 왜 그랬습니까?
- Optional prompt: What, if anything, felt satisfactory, difficult, or unresolved?

**OER1**

- EN: In a real workplace, would you share different information if you negotiated in the same way? Why or why not?
- KO: 실제 직장에서 같은 방식으로 협상한다면 공유할 정보가 달라지겠습니까? 달라지거나 같을 이유는 무엇입니까?
- Optional prompt: Consider ongoing working relationships, workplace expectations, or consequences beyond this study.

**OEP1**

- EN: How did you feel about the way your Proxy represented you and how much say you had in the negotiation, and why?
- KO: 내 Proxy가 나를 대변한 방식과 협상에 내 의견을 반영할 수 있었던 정도에 대해 어떻게 느꼈으며, 왜 그렇게 느꼈습니까?
- Optional prompt: Consider what matched or differed from your intentions and any moments when you wanted more or less involvement.

**OEP3**

- EN: Who, if anyone, do you see as responsible for the reasons your Proxy conveyed, and why?
- KO: 내 Proxy가 전달한 이유에 대해 누구에게 책임이 있다고 보며, 왜 그렇게 생각합니까?
- Optional prompt: You may discuss yourself, the AI, both, or neither; their responsibilities need not be the same.

**OEP4**

- EN: How did you understand where the reasons conveyed by the other Proxy came from, and why?
- KO: 상대 Proxy가 전달한 이유가 어디에서 왔다고 이해했으며, 왜 그렇게 생각합니까?
- Optional prompt: What could you tell, or not tell, about the person's input and any AI contribution? How did that shape your interpretation?

**OEP5**

- EN: Who, if anyone, do you see as responsible for the reasons the other Proxy conveyed, and why?
- KO: 상대 Proxy가 전달한 이유에 대해 누구에게 책임이 있다고 보며, 왜 그렇게 생각합니까?
- Optional prompt: You may discuss the person it represented, the AI, both, or neither; their responsibilities need not be the same.

Under legacy `2.27-open-v2`, OEP1 asked how well the Proxy expressed what the participant wanted to say, and OEP2 separately asked how Proxy use affected the participant's sense of control. Those identifiers and exact participant-facing strings remain available only for records already using that version.

**OEC1**

- EN: What difference, if any, mattered most to you between negotiating directly and using a Proxy, and why?
- KO: 직접 협상과 Proxy 협상 사이에서 가장 중요하게 느낀 차이가 있다면 무엇이며, 왜 중요했습니까?
- Optional prompt: You can also mention an experience or concern that the earlier questions did not cover.

**OET1**

- EN: Is there anything else about this task or the way you negotiated that you would like to share?
- KO: 이번 과제나 협상 방식에 대해 그 밖에 나누고 싶은 내용이 있습니까?
- Optional prompt: Optional. You may leave this blank.
