/**
 * `/practice` kept as a redirect to `/practice/1`.
 *
 * The route moved to `/practice/[index]` when the PI added a second practice
 * round before Task 2 (2026-09-09). This stays because the bare path is in
 * bookmarks, in the dev panel's history, and in anything a participant may
 * have open in a second tab — and because a 404 mid-study is unrecoverable
 * for a paid session. It never appears in `FLOW`, so the progress bar and the
 * dev panel both name `/practice/1` (interface rule 3: one source).
 */

import { redirect } from "next/navigation";

export default function PracticeIndexPage() {
  redirect("/practice/1");
}
