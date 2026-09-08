export const RECOVERABLE_REQUEST_ATTEMPTS = 3;
export const RECOVERABLE_REQUEST_TIMEOUT_MS = 20_000;
export const RECOVERABLE_REQUEST_BACKOFF_MS = 350;

export function nextCountdownValue(
  remaining: number,
  running: boolean,
  paused: boolean,
) {
  return running && !paused ? Math.max(0, remaining - 1) : remaining;
}

export class RecoverableRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "RecoverableRequestError";
  }
}

interface RetryOptions<T> {
  attempts?: number;
  timeoutMs?: number;
  backoffMs?: number;
  signal?: AbortSignal;
  onFailure?: (attempt: number, error: unknown) => void;
  validate?: (value: unknown) => value is T;
}

function abortError() {
  return new DOMException("Request aborted", "AbortError");
}

async function wait(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const id = setTimeout(finish, ms);
    const abort = () => {
      clearTimeout(id);
      signal?.removeEventListener("abort", abort);
      reject(abortError());
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}

/** A bounded, replay-safe JSON request used by one staged negotiation turn. */
export async function fetchJsonWithRetry<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  options: RetryOptions<T> = {},
): Promise<T> {
  const attempts = options.attempts ?? RECOVERABLE_REQUEST_ATTEMPTS;
  const timeoutMs = options.timeoutMs ?? RECOVERABLE_REQUEST_TIMEOUT_MS;
  const backoffMs = options.backoffMs ?? RECOVERABLE_REQUEST_BACKOFF_MS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (options.signal?.aborted) throw abortError();
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      if (!response.ok) {
        throw new RecoverableRequestError(
          `Request failed with ${response.status}`,
          response.status,
        );
      }
      const value: unknown = await response.json();
      if (options.validate && !options.validate(value)) {
        throw new RecoverableRequestError("Response was incomplete");
      }
      return value as T;
    } catch (error) {
      if (options.signal?.aborted) throw abortError();
      lastError = error;
      options.onFailure?.(attempt, error);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
    }

    if (attempt < attempts) {
      await wait(backoffMs * attempt, options.signal);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new RecoverableRequestError("Request failed");
}
