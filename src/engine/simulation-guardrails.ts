import { MAX_ITERATIONS, type SimulationConfig } from './simulation-types';

/** Thrown by validateSimulationConfig when iterations exceeds the engine cap. */
export class MaxIterationsExceededError extends Error {
  readonly requested: number;
  readonly cap: number;
  constructor(requested: number) {
    super(`Iterations ${requested} exceeds engine cap ${MAX_ITERATIONS}`);
    this.name = 'MaxIterationsExceededError';
    this.requested = requested;
    this.cap = MAX_ITERATIONS;
  }
}

/**
 * Validate a SimulationConfig against the engine guardrails.
 *
 *  - iterations must be in [1, MAX_ITERATIONS].
 *  - maxRounds must be at least 1.
 *  - wallClockBudgetMs (if set) must be a non-negative finite number.
 *
 * Throws on any violation. The Forecast UI calls this before submitting
 * a run so a bad config produces a clean error rather than freezing the
 * worker startup path.
 */
export function validateSimulationConfig(config: SimulationConfig): void {
  if (!Number.isInteger(config.iterations) || config.iterations < 1) {
    throw new Error(`iterations must be a positive integer, got ${config.iterations}`);
  }
  if (config.iterations > MAX_ITERATIONS) {
    throw new MaxIterationsExceededError(config.iterations);
  }
  if (!Number.isInteger(config.maxRounds) || config.maxRounds < 1) {
    throw new Error(`maxRounds must be a positive integer, got ${config.maxRounds}`);
  }
  if (config.wallClockBudgetMs !== undefined) {
    if (!Number.isFinite(config.wallClockBudgetMs) || config.wallClockBudgetMs < 0) {
      throw new Error(
        `wallClockBudgetMs must be a non-negative finite number, got ${config.wallClockBudgetMs}`
      );
    }
  }
}

/**
 * Wrap a void-returning callback so it fires at most once per
 * `minIntervalMs`. Subsequent calls within the window are dropped except
 * for the most recent set of arguments, which `flush()` can deliver
 * synchronously when the caller wants a guaranteed final emit.
 *
 * Used by the worker to throttle postMessage progress events without
 * losing the final tick.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttleProgress<TArgs extends any[]>(
  callback: (...args: TArgs) => void,
  minIntervalMs: number,
  now: () => number = defaultNow
): ((...args: TArgs) => void) & { flush(): void } {
  let lastFired = -Infinity;
  let pending: TArgs | null = null;
  const wrapped = (...args: TArgs): void => {
    const t = now();
    if (t - lastFired >= minIntervalMs) {
      lastFired = t;
      pending = null;
      callback(...args);
    } else {
      pending = args;
    }
  };
  (wrapped as { flush: () => void }).flush = () => {
    if (pending) {
      callback(...pending);
      pending = null;
      lastFired = now();
    }
  };
  return wrapped as ((...args: TArgs) => void) & { flush(): void };
}

function defaultNow(): number {
  return Date.now();
}
