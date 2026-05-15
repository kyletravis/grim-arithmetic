/**
 * Web Worker entry for the Monte Carlo simulation.
 *
 * Bundled as a separate chunk by Vite when the host code constructs a Worker
 * via `new Worker(new URL('./simulation.worker.ts', import.meta.url),
 * { type: 'module' })`. The worker imports the pure engine functions only —
 * no Foundry globals — so the same code path also runs in the synchronous
 * fallback when Worker is unavailable (Vitest / node).
 *
 * Message protocol:
 *   Host -> Worker: { type: 'run', setup, config }
 *   Host -> Worker: { type: 'abort' }
 *   Worker -> Host: { type: 'progress', completed, total }
 *   Worker -> Host: { type: 'result', result }
 *   Worker -> Host: { type: 'error', message }
 */
import { runSimulation } from './run-simulation';
import { throttleProgress } from './simulation-guardrails';
import type { EncounterSetup, SimulationConfig, SimulationResult } from './simulation-types';

export type WorkerInbound =
  | { type: 'run'; setup: EncounterSetup; config: SimulationConfig }
  | { type: 'abort' };

export type WorkerOutbound =
  | { type: 'progress'; completed: number; total: number }
  | { type: 'result'; result: SimulationResult }
  | { type: 'error'; message: string };

// Worker context. Avoid touching window/document; this file must work
// inside a DedicatedWorkerGlobalScope without DOM globals.
const ctx = (typeof self !== 'undefined' ? self : globalThis) as unknown as {
  addEventListener: (type: string, listener: (event: { data: WorkerInbound }) => void) => void;
  postMessage: (message: WorkerOutbound) => void;
};

let abortFlag = false;
const abortSignal = {
  get aborted(): boolean {
    return abortFlag;
  }
};

ctx.addEventListener('message', (event) => {
  const message = event.data;
  if (!message || typeof message !== 'object') return;

  if (message.type === 'abort') {
    abortFlag = true;
    return;
  }

  if (message.type === 'run') {
    abortFlag = false;
    const sendProgress = throttleProgress(
      (completed: number, total: number) =>
        ctx.postMessage({ type: 'progress', completed, total }),
      100
    );

    try {
      const result = runSimulation(message.setup, message.config, {
        onProgress: sendProgress,
        abortSignal
      });
      sendProgress.flush();
      ctx.postMessage({ type: 'result', result });
    } catch (err) {
      ctx.postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : String(err)
      });
    }
  }
});
