import { cx } from "@/components/ui";

export function NavigationNotice({ className }: { className?: string }) {
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
