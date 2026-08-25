/**
 * Lets the unit tests import the shipped TypeScript sources directly.
 *
 * The app never runs through this — Next.js has its own compiler. This exists
 * so tests can exercise `lib/negotiation/machine`, `lib/ai/validator` and
 * `lib/tasks` AS SHIPPED, instead of the earlier approach of regex-stripping
 * a copied function body, which silently tested nothing once the source
 * drifted. Uses the `typescript` package already in devDependencies; no new
 * dependency and no build step.
 */
import { register } from "node:module";

register(new URL("./ts-hooks.mjs", import.meta.url));
