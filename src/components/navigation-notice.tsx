import { cx } from "@/components/ui";

/**
 * The forward-only notice.
 *
 * `plain` is the quiet in-flow reminder that sits above an action bar. The
 * `prominent` variant is the same fact stated as the first thing on the
 * instruction page, where it is the one warning a participant has to have read
 * before they start: a negotiation is live state, and a reload ends it.
 *
 * Both tones are the caution family, never the error red — the participant has
 * not done anything wrong, and a validation-red panel on the first instruction
 * screen reads as a fault in the study rather than as a thing to avoid.
 */
export function NavigationNotice({
  className,
  tone = "plain",
}: {
  className?: string;
  tone?: "plain" | "prominent";
}) {
  if (tone === "prominent") {
    return (
      <div
        className={cx(
          "flex items-start gap-3 rounded-[var(--radius)] border border-[#f0dcc0] bg-[var(--caution-soft)] px-4 py-3.5 text-[#6d3d05] shadow-sm",
          className,
        )}
      >
        <span aria-hidden className="text-lg leading-6">
          ⚠
        </span>
        <div className="max-w-prose">
          <p className="text-[0.95rem] font-bold leading-6">
            Please do not refresh this page or use your browser’s Back button at
            any point in this study.
          </p>
          <p className="mt-1 text-sm leading-relaxed">
            Your answers are saved as you go, but a negotiation that is
            interrupted cannot be resumed and the study only moves forward.
          </p>
        </div>
      </div>
    );
  }

  return (
    <p
      className={cx(
        "rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-sm leading-relaxed text-[var(--ink-2)]",
        className,
      )}
    >
      Please avoid refreshing or using your browser’s Back button.
    </p>
  );
}
