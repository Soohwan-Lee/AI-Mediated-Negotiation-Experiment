export type PracticeCheckDecision =
  | "choose"
  | "submit"
  | "retry"
  | "complete";

export interface PracticeCheckSelection {
  answer: string;
  submitted: boolean;
  attempt: number;
}

export function selectPracticeCheckAnswer(
  current: PracticeCheckSelection,
  nextAnswer: string,
  correctAnswer: string,
): PracticeCheckSelection {
  const retrying = current.submitted && current.answer !== correctAnswer;
  return {
    answer: nextAnswer,
    // A wrong choice shows its correction immediately. A correct choice is
    // still explicitly checked before the participant can continue.
    submitted: nextAnswer !== correctAnswer,
    attempt: current.attempt + (retrying ? 1 : 0),
  };
}

export function practiceCheckDecision(
  answer: string,
  correctAnswer: string,
  submitted: boolean,
): PracticeCheckDecision {
  if (!answer) return "choose";
  if (!submitted) return "submit";
  return answer === correctAnswer ? "complete" : "retry";
}
