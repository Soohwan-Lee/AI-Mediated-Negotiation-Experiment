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
  AmountScale,
  Card,
  CardTitle,
  ChoiceList,
  Cue,
  Field,
  Scale,
  Select,
  TextArea,
  TextInput,
} from "./ui";

export type Answers = SurveyResponses;

/**
 * Show each item's id above its question — `PERC-F1`, `OE-P4`, `SUS1`.
 *
 * FOR THE RESEARCHER READING THE SCREENS, NOT FOR THE PARTICIPANT. The ids are
 * the column names in the export (Interface rule 7), so having them on screen
 * is what makes a walk-through checkable against Design §9 without counting
 * questions. Flip this one constant to hide every one of them.
 *
 * It is rendered as a SIBLING of the control and never reaches an answer: the
 * `statement` and `label` strings passed down are exactly what `lib/measures`
 * holds, so nothing an id could contaminate is saved or logged.
 *
 * OFF IN A RECRUITING BUILD, BY THE SAME SWITCH THAT DROPS THE DEV PANEL. Some
 * of these ids are tells — `SUS1` on the suspicion probe names what that probe
 * is for, and the `OWN-AI` / `OTHER-AI` prefixes label a whole block by its
 * construct. Tying it to `NEXT_PUBLIC_DEV_TOOLS=off` means there is one thing
 * to set before recruiting, not two, and a preview deployment keeps the tags.
 */
export const SHOW_ITEM_IDS = process.env.NEXT_PUBLIC_DEV_TOOLS !== "off";

function ItemTag({ id }: { id: string }) {
  if (!SHOW_ITEM_IDS) return null;
  return (
    <span
      aria-hidden
      className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-[var(--ink-3)]"
    >
      {id}
    </span>
  );
}

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

  const required = requiredIds(block);
  const left = required.filter(
    (id) => answers[id] === undefined || answers[id] === "",
  ).length;

  return (
    <Card className="mb-6">
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

  if (item.kind === "scale") {
    // The tag is a sibling rather than part of `statement`: `Scale` types the
    // statement as a string and mirrors it into its own `<legend>`, so folding
    // the id in would read the id out to a screen reader as part of the
    // question. `Scale` keeps the `q-` anchor.
    //
    // THE SEPARATOR MOVES OUT WITH IT. `Scale`'s own rule is
    // `border-b … last:border-b-0`, which counts siblings — wrap each scale in
    // a div and every one becomes an only child, so `last:` matches them all
    // and the whole block loses its rules. So the scale is asked for `compact`
    // (no rule of its own) and the wrapper carries the rule instead, where it
    // is still one per item and still dropped on the last.
    return (
      <div className="border-b border-[var(--line)] py-4 last:border-b-0">
        <ItemTag id={item.id} />
        <Scale
          id={item.id}
          statement={item.text}
          value={asNumber}
          onChange={(v) => onChange(item.id, v)}
          lowAnchor={item.low}
          highAnchor={item.high}
          points={item.points}
          flagged={flagged}
          compact
        />
      </div>
    );
  }

  // 0-100 judgements get their own control rather than a 7-point row: the
  // receiver-side items are read on a hundred-point scale in the analysis, and
  // a stepped picker keeps them free of a starting position.
  if (item.kind === "amount") {
    return (
      <div id={`q-${item.id}`} className="scroll-mt-24">
        <ItemTag id={item.id} />
        <Field label={item.text} required={!optional} flagged={flagged}>
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
      <ItemTag id={item.id} />
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
