import { PollingTimeoutError } from './errors.js';
import type { WaitOptions } from './types.js';

const DEFAULT_INTERVAL = 2000;
const DEFAULT_TIMEOUT = 600_000;
const DEFAULT_BACKOFF = 1.5;
const DEFAULT_MAX_INTERVAL = 30_000;
const DEFAULT_JITTER = 500;

function requirePositiveFinite(name: string, value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number, got ${value}`);
  }
  return value;
}

function requireBackoff(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    throw new RangeError(`backoff must be a finite number >= 1, got ${value}`);
  }
  return value;
}

function requireJitter(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`jitter must be a finite non-negative number, got ${value}`);
  }
  return value;
}

/**
 * Generic polling helper. Calls `retrieve` repeatedly until the returned
 * object's `status` field is in `terminalStates`, or the timeout is reached.
 * Uses exponential backoff with jitter per the standard polling contract.
 */
export async function pollUntilComplete<T extends { status: string }>(
  retrieve: () => Promise<T>,
  terminalStates: readonly string[],
  label: string,
  options?: WaitOptions,
): Promise<T> {
  let interval = requirePositiveFinite('interval', options?.interval ?? DEFAULT_INTERVAL);
  const timeout = requirePositiveFinite('timeout', options?.timeout ?? DEFAULT_TIMEOUT);
  const backoff = requireBackoff(options?.backoff ?? DEFAULT_BACKOFF);
  const maxInterval = requirePositiveFinite('maxInterval', options?.maxInterval ?? DEFAULT_MAX_INTERVAL);
  const jitterMax = requireJitter(options?.jitter ?? DEFAULT_JITTER);
  const start = performance.now();

  while (true) {
    options?.signal?.throwIfAborted();

    const resource = await retrieve();

    if (terminalStates.includes(resource.status)) {
      return resource;
    }

    if (performance.now() - start >= timeout) {
      throw new PollingTimeoutError(
        `${label} did not complete within ${timeout}ms (last status: ${resource.status})`,
      );
    }

    const jitter = Math.random() * jitterMax;
    await sleepWithAbort(interval + jitter, options?.signal);
    interval = Math.min(interval * backoff, maxInterval);
  }
}

function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
