import { isMonteCarloEnabled } from '../settings';
import { runSimulation } from './run-simulation';
import type { EncounterSetup, SimulationConfig, SimulationResult } from './simulation-types';
import type { WorkerInbound, WorkerOutbound } from './simulation.worker';

/** Thrown by runSimulationInWorker when the kill switch is off. */
export class MonteCarloDisabledError extends Error {
  constructor() {
    super('Monte Carlo encounter simulation is disabled in module settings.');
    this.name = 'MonteCarloDisabledError';
  }
}

export interface RunSimulationInWorkerOptions {
  onProgress?: (completed: number, total: number) => void;
}

export interface RunSimulationHandle {
  promise: Promise<SimulationResult>;
  cancel(): void;
}

/**
 * Run the simulation off the main thread.
 *
 *  - When the KHT-79 kill switch is off: returns a handle whose promise
 *    rejects with MonteCarloDisabledError immediately; no Worker is
 *    constructed.
 *  - When Worker is undefined (test / node environment): falls back to a
 *    synchronous in-thread run. The same onProgress / cancel contract
 *    applies. This keeps Vitest coverage end-to-end without mocking
 *    Worker.
 *  - Otherwise: constructs a module Worker via the standard Vite pattern,
 *    forwards onProgress, resolves on result, rejects on error, and
 *    terminates the worker in all terminal cases.
 *
 * The cancel() function posts an abort message and is idempotent. The
 * worker checks the abort flag between iterations and returns a partial
 * SimulationResult flagged aborted: true.
 */
export function runSimulationInWorker(
  setup: EncounterSetup,
  config: SimulationConfig,
  options: RunSimulationInWorkerOptions = {}
): RunSimulationHandle {
  if (!isMonteCarloEnabled()) {
    return {
      promise: Promise.reject(new MonteCarloDisabledError()),
      cancel: () => {}
    };
  }

  if (typeof Worker === 'undefined') {
    return runInSyncFallback(setup, config, options);
  }

  return runInActualWorker(setup, config, options);
}

function runInSyncFallback(
  setup: EncounterSetup,
  config: SimulationConfig,
  options: RunSimulationInWorkerOptions
): RunSimulationHandle {
  const signal = { aborted: false };
  const promise = Promise.resolve().then(() =>
    runSimulation(setup, config, {
      onProgress: options.onProgress,
      abortSignal: signal
    })
  );
  return {
    promise,
    cancel: () => {
      signal.aborted = true;
    }
  };
}

function runInActualWorker(
  setup: EncounterSetup,
  config: SimulationConfig,
  options: RunSimulationInWorkerOptions
): RunSimulationHandle {
  const worker = new Worker(
    new URL('./simulation.worker.ts', import.meta.url),
    { type: 'module' }
  );

  let cancelled = false;
  let settled = false;

  const promise = new Promise<SimulationResult>((resolve, reject) => {
    const onMessage = (event: MessageEvent<WorkerOutbound>) => {
      const message = event.data;
      if (!message || typeof message !== 'object') return;
      switch (message.type) {
        case 'progress':
          options.onProgress?.(message.completed, message.total);
          break;
        case 'result':
          finalize(() => resolve(message.result));
          break;
        case 'error':
          finalize(() => reject(new Error(message.message)));
          break;
      }
    };
    const onError = (event: ErrorEvent) => {
      finalize(() => reject(new Error(event.message || 'Worker error')));
    };

    const finalize = (callback: () => void) => {
      if (settled) return;
      settled = true;
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      try {
        callback();
      } finally {
        worker.terminate();
      }
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);

    const initial: WorkerInbound = { type: 'run', setup, config };
    worker.postMessage(initial);
  });

  return {
    promise,
    cancel: () => {
      if (cancelled || settled) return;
      cancelled = true;
      const abort: WorkerInbound = { type: 'abort' };
      worker.postMessage(abort);
    }
  };
}
