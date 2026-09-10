"use client";

export function LoadRetry({ onRetry, label = "your saved answers" }: {
  onRetry: () => void;
  label?: string;
}) {
  return (
    <div role="alert" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p>We could not load {label}. Please try again. Keep this page open.</p>
      <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-amber-400 bg-white px-4 py-2 font-bold hover:bg-amber-100">
        Retry loading
      </button>
    </div>
  );
}
