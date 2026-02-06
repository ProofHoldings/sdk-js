import { PollingTimeoutError } from './errors.js';
import type { WaitOptions } from './types.js';

const DEFAULT_INTERVAL = 3000;
const DEFAULT_TIMEOUT = 600_000;

/**
 * Generic polling helper. Calls `retrieve` repeatedly until the returned
 * object's `status` field is in `terminalStates`, or the timeout is reached.
 */
export async function pollUntilComplete<T extends { status: string }>(
  retrieve: () => Promise<T>,
  terminalStates: readonly string[],
  label: string,
  options?: WaitOptions,
): Promise<T> {
  const interval = options?.interval ?? DEFAULT_INTERVAL;
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  const start = Date.now();

  while (true) {
    options?.signal?.throwIfAborted();

    const resource = await retrieve();

    if (terminalStates.includes(resource.status)) {
      return resource;
    }

    if (Date.now() - start >= timeout) {
      throw new PollingTimeoutError(
        `${label} did not complete within ${timeout}ms (last status: ${resource.status})`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
