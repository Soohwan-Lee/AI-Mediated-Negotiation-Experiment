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
import { isMissingResponse } from "@/lib/survey-progress";
import type { SurveyResponses } from "@/lib/types";
import {
  AmountScale,
  Card,
  CardTitle,
  ChoiceList,
  Cue,
  cx,
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
  stackedScales = false,
}: {
  block: Block;
  answers: Answers;
  onChange: (id: string, value: string | number) => void;
  /** Ids to mark as missing, after a participant tried to continue. */
  flagged?: Set<string>;
  /** Give scale prompts the full card width before the 1–7 controls. */
  stackedScales?: boolean;
}) {
  const optional = new Set(block.optional ?? []);

  const required = requiredIds(block);
  const left = required.filter(
    (id) => isMissingResponse(answers[id]),
  ).length;

  return (
    <Card
      className={cx(
        "mb-6",
        stackedScales &&
          "[&_fieldset>div]:!block [&_fieldset>div>p]:!mb-3 [&_fieldset>div>div]:!mx-auto",
      )}
    >
      <CardTitle
        hint={block.hint}
        aside={
          required.length === 0 ? null : left > 0 ? (
            <Cue>{left} remaining</Cue>
          ) : (
            <Cue tone="positive">✓ Complete</Cue>
          )
        }
      >
        {block.title}
      </CardTitle>
      <div className="space-y-4 pt-1">
        {pairShortItems(block.items).map((row) =>
          row.length === 1 ? (
            <MeasureItem
              key={row[0].id}
              item={row[0]}
              value={answers[row[0].id]}
              onChange={onChange}
              optional={optional.has(row[0].id)}
              flagged={flagged?.has(row[0].id)}
            />
          ) : (
            <div
              key={row.map((i) => i.id).join("+")}
              className="grid items-start gap-4 sm:grid-cols-2"
            >
              {row.map((item) => (
                <MeasureItem
                  key={item.id}
                  item={item}
                  value={answers[item.id]}
                  onChange={onChange}
                  optional={optional.has(item.id)}
                  flagged={flagged?.has(item.id)}
                />
              ))}
            </div>
          ),
        )}
      </div>
    </Card>
  );
}

/**
 * Groups runs of `half` items into pairs, leaving everything else on its own
 * line. Order is preserved exactly — an item never moves past a neighbour, so
 * the sequence a participant reads is still the sequence in `lib/measures`.
 */
function pairShortItems(items: Item[]): Item[][] {
  const rows: Item[][] = [];
  for (const item of items) {
    const half = "half" in item && item.half;
    const last = rows[rows.length - 1];
    const lastIsOpenPair =
      last?.length === 1 && "half" in last[0] && last[0].half;

    if (half && lastIsOpenPair) last.push(item);
    else rows.push([item]);
  }
  return rows;
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
  const labelledText = `(${item.id.replace(/_t[12]$/, "")}) ${item.text}`;

  if (item.kind === "scale") {
    // No wrapper here: `Scale`'s own `border-b … last:border-b-0` already draws
    // one rule per item and drops it on the last, and it counts SIBLINGS — a
    // div around each scale would make every one an only child, so `last:`
    // would match them all and the block would lose its rules entirely.
    // `Scale` keeps the `q-` anchor. The plain wording goes to `srStatement`
    // so the `<legend>` a screen reader announces carries no id.
    return (
      <Scale
        id={item.id}
        statement={labelledText}
        srStatement={labelledText}
        value={asNumber}
        onChange={(v) => onChange(item.id, v)}
        lowAnchor={item.low}
        highAnchor={item.high}
        points={item.points}
        flagged={flagged}
      />
    );
  }

  // 0-100 judgements get their own control rather than a 7-point row: the
  // receiver-side items are read on a hundred-point scale in the analysis, and
  // a stepped picker keeps them free of a starting position.
  if (item.kind === "amount") {
    return (
      <div id={`q-${item.id}`} className="scroll-mt-24">
      <Field
          label={labelledText}
          required={!optional}
          flagged={flagged}
        >
          <AmountScale
            id={item.id}
            value={asNumber}
            onChange={(v) => onChange(item.id, v)}
            step={item.step ?? 10}
            unit={item.unit}
          />
        </Field>
      </div>
    );
  }

  return (
    <div id={`q-${item.id}`} className="scroll-mt-24">
      <Field
        label={labelledText}
        required={!optional}
        flagged={flagged}
      >
        {item.kind === "choice" ? (
          <ChoiceList
            name={item.id}
            ariaLabel={labelledText}
            value={asText}
            onChange={(v) => onChange(item.id, v)}
            options={item.options}
            columns={item.columns}
          />
        ) : item.kind === "select" ? (
          <Select
            ariaLabel={labelledText}
            value={asText}
            onChange={(v) => onChange(item.id, v)}
            options={item.options}
          />
        ) : item.kind === "number" ? (
          <TextInput
            type="number"
            inputMode="numeric"
            ariaLabel={labelledText}
            value={asText}
            onChange={(v) => onChange(item.id, v)}
            placeholder={item.placeholder}
          />
        ) : item.kind === "line" ? (
          <TextInput
            ariaLabel={labelledText}
            value={asText}
            onChange={(v) => onChange(item.id, v)}
            placeholder={item.placeholder}
          />
        ) : (
          <TextArea
            ariaLabel={labelledText}
            value={asText}
            onChange={(v) => onChange(item.id, v)}
            rows={item.rows ?? 3}
            placeholder={item.placeholder}
          />
        )}
      </Field>
      {item.hint ? (
        <p className="mt-2 text-xs leading-relaxed text-[var(--ink-3)]">
          {item.hint}
        </p>
      ) : null}
    </div>
  );
}

/** Required ids across several blocks that still have no answer. */
export function missingIds(blocks: Block[], answers: Answers): string[] {
  return blocks
    .flatMap(requiredIds)
    .filter((id) => isMissingResponse(answers[id]));
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

/**
 * "Previous" for a paginated questionnaire.
 *
 * It pages WITHIN one route only: the part index is component state, so
 * stepping back re-renders an earlier part of the same battery and never
 * leaves the URL the progress bar is derived from (interface rule 3). Crossing
 * a route boundary is `BACK_STEPS` and `BackButton`, which is a different
 * control with different rules.
 *
 * It renders as the action bar's `secondary` slot and is deliberately quieter
 * than the primary action: going on is the expected move, revising is
 * available. It carries no `.cue-ring` — nothing is waiting on it
 * (interface rule 9).
 *
 * The caller must not render it on the first part. There is nothing behind
 * part 0 inside the route, and a dead control that looks live is worse than
 * no control.
 */
export function PreviousPart({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[var(--ink-2)] transition-all hover:bg-slate-50 hover:text-[var(--ink)] shadow-2xs cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span aria-hidden>←</span>
      <span>Previous</span>
    </button>
  );
}
