/**
 * Samantha background work — starts /api/agent/buyer while the global orb
 * remains the sole visible Buyer assistant surface.
 */
import { runBuyerRuntimeTask } from './runBuyerRuntimeTask';

export type BuyerRuntimeJobUpdate = {
  status: 'started' | 'completed' | 'failed' | 'busy';
  task: string;
  summary?: string;
  error?: string;
};

type Listener = (update: BuyerRuntimeJobUpdate) => void;

const listeners = new Set<Listener>();
let inflight: AbortController | null = null;
let inflightTask: string | null = null;

export function subscribeBuyerRuntimeJob(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(update: BuyerRuntimeJobUpdate): void {
  for (const listener of listeners) {
    try {
      listener(update);
    } catch {
      /* ignore listener errors */
    }
  }
}

export type StartBuyerRuntimeBackgroundResult = {
  ok: boolean;
  started: boolean;
  finished: false;
  message: string;
  sessionId?: string;
  busy?: boolean;
};

function summarizeResult(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return 'All done.';
  try {
    const parsed = JSON.parse(trimmed) as { summary?: string; message?: string };
    const summary = (parsed.summary || parsed.message || '').trim();
    if (summary) return summary.slice(0, 280);
  } catch {
    /* plain text */
  }
  return trimmed.slice(0, 280);
}

/** Start buyer agent work in the background. One in-flight job; a second request is rejected. */
export function startBuyerRuntimeBackground(params: {
  task: string;
  sessionId: string;
  subjectId: string;
  walletAddress?: string | null;
  context?: Record<string, unknown>;
  headers?: Record<string, string>;
}): StartBuyerRuntimeBackgroundResult {
  const task = params.task.trim();
  if (!task) {
    return {
      ok: false,
      started: false,
      finished: false,
      message: 'I need a bit more detail before I can start that.',
    };
  }

  if (inflight) {
    const busyMsg = inflightTask
      ? `I'm still working on that — I'll let you know when "${inflightTask.slice(0, 60)}" is done.`
      : "I'm still working on that — I'll let you know when it's done.";
    notify({ status: 'busy', task, error: busyMsg });
    return {
      ok: false,
      started: false,
      finished: false,
      message: busyMsg,
      busy: true,
      sessionId: params.sessionId,
    };
  }

  const controller = new AbortController();
  inflight = controller;
  inflightTask = task;

  const startedMessage = "I've started that — I'll let you know when it's done.";

  notify({ status: 'started', task });

  void (async () => {
    let summary = '';
    let failed: string | null = null;
    const progressTimer = globalThis.setTimeout(() => {
      if (inflight === controller) {
        notify({
          status: 'started',
          task,
          summary: "I'm still working on that — longer planning tasks can take about a minute.",
        });
      }
    }, 30_000);
    try {
      await runBuyerRuntimeTask({
        prompt: task,
        sessionId: params.sessionId,
        subjectId: params.subjectId,
        walletAddress: params.walletAddress,
        headers: params.headers,
        signal: controller.signal,
        context: {
          samantha_background: true,
          ...(params.context ?? {}),
        },
        onResult: (content) => {
          summary = summarizeResult(content);
        },
        onError: (error) => {
          failed = error;
        },
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      failed = err instanceof Error ? err.message : 'Something went wrong.';
    } finally {
      globalThis.clearTimeout(progressTimer);
      if (inflight === controller) {
        inflight = null;
        inflightTask = null;
      }
    }

    if (controller.signal.aborted) return;

    if (failed) {
      notify({
        status: 'failed',
        task,
        error: failed,
        summary: `Sorry — that didn't finish (${failed.slice(0, 120)}).`,
      });
      return;
    }

    notify({
      status: 'completed',
      task,
      summary: summary || 'All done.',
    });
  })();

  return {
    ok: true,
    started: true,
    finished: false,
    message: startedMessage,
    sessionId: params.sessionId,
  };
}
