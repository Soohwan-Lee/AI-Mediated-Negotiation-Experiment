"use client";

/**
 * Renders questionnaire blocks defined in `lib/measures`.
 *
 * Pages hold answers and decide what to do with them; they never lay out an
 * item. That is what keeps a battery revision to a single file, and it is why
 * counting what is still unanswered can be done generically rather than
 * re-derived by hand on every screen.
 */

import type { Block, Item } from "@/lib/measures";
import { requiredIds } from "@/lib/measures";
import type { SurveyResponses } from "@/lib/types";
import {
  Card,
  CardTitle,
  ChoiceList,
  Field,
  Scale,
  Select,
  TextArea,
  TextInput,
} from "./ui";

export type Answers = SurveyResponses;

export function MeasureBlock({
  block,
  answers,
  onChange,
  flagged,
}: {
  block: Block;
  answers: Answers;
  onChange: (id: string, value: string | number) => void;
  /** Ids to mark as missing, after a participant tried to continue. */
  flagged?: Set<string>;
}) {
  const optional = new Set(block.optional ?? []);

  return (
    <Card className="mb-5">
      <CardTitle hint={block.hint}>{block.title}</CardTitle>
      {block.items.map((item) => (
        <MeasureItem
          key={item.id}
          item={item}
          value={answers[item.id]}
          onChange={onChange}
          optional={optional.has(item.id)}
          flagged={flagged?.has(item.id)}
        />
      ))}
    </Card>
  );
}

function MeasureItem({
  item,
  value,
  onChange,
  optional,
  flagged,
}: {
  item: Item;
  value: unknown;
  onChange: (id: string, value: string | number) => void;
  optional: boolean;
  flagged?: boolean;
}) {
  const asText = typeof value === "string" ? value : "";
  const asNumber = typeof value === "number" ? value : null;

  if (item.kind === "scale") {
    return (
      <Scale
        id={item.id}
        statement={item.text}
        value={asNumber}
        onChange={(v) => onChange(item.id, v)}
        lowAnchor={item.low}
        highAnchor={item.high}
        points={item.points}
        flagged={flagged}
      />
    );
  }

  return (
    <div id={`q-${item.id}`} className="scroll-mt-24">
      <Field label={item.text} required={!optional} flagged={flagged}>
        {item.kind === "choice" ? (
          <ChoiceList
            name={item.id}
            value={asText}
            onChange={(v) => onChange(item.id, v)}
            options={item.options}
            columns={item.columns}
          />
        ) : item.kind === "select" ? (
          <Select
            value={asText}
            onChange={(v) => onChange(item.id, v)}
            options={item.options}
          />
        ) : item.kind === "number" ? (
          <TextInput
            type="number"
            inputMode="numeric"
            value={asText}
            onChange={(v) => onChange(item.id, v)}
            placeholder={item.placeholder}
          />
        ) : item.kind === "line" ? (
          <TextInput
            value={asText}
            onChange={(v) => onChange(item.id, v)}
            placeholder={item.placeholder}
          />
        ) : (
          <TextArea
            value={asText}
            onChange={(v) => onChange(item.id, v)}
            rows={item.rows ?? 3}
            placeholder={item.placeholder}
          />
        )}
      </Field>
    </div>
  );
}

/** Required ids across several blocks that still have no answer. */
export function missingIds(blocks: Block[], answers: Answers): string[] {
  return blocks
    .flatMap(requiredIds)
    .filter((id) => answers[id] === undefined || answers[id] === "");
}

/**
 * Live "12 of 21 answered" for the action bar. A long page should say how it
 * is going before the participant presses anything.
 */
export function answeredNote(blocks: Block[], answers: Answers): string {
  const total = blocks.flatMap(requiredIds).length;
  if (total === 0) return "";
  const done = total - missingIds(blocks, answers).length;
  return done === total ? "All answered." : `${done} of ${total} answered`;
}
