/**
 * Shared Buyer agent POST + SSE consume for Samantha background handoff.
 */
import { buildAgentControlPlaneUrl } from './agentControlPlane';

export type AgentStreamHandlers = {
  onDelta?: () => void;
  onResult?: (content: string, outcome?: VerifiedRuntimeOutcome) => Promise<void> | void;
  onError?: (error: string) => void;
  onDone?: () => void;
};

export type VerifiedRuntimeOutcome = {
  status: 'completed';
  summary: string;
  executed_tools: string[];
  postcondition: {
    verified: true;
    evidence: string;
  };
};

export async function consumeAgentSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: AgentStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    if (signal?.aborted) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      handlers.onDone?.();
      return;
    }

    const { done, value } = await reader.read();
    if (done) {
      handlers.onDone?.();
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.replace(/^data:\s*/, '').trim();
      if (!data || data === '[DONE]') continue;

      try {
        const event = JSON.parse(data) as {
          type?: string;
          content?: string;
          error?: string;
          outcome?: VerifiedRuntimeOutcome;
        };
        if (event.type === 'assistant_delta') {
          handlers.onDelta?.();
        } else if (event.type === 'result' && typeof event.content === 'string') {
          await handlers.onResult?.(event.content, event.outcome);
        } else if (event.type === 'error' && typeof event.error === 'string') {
          handlers.onError?.(event.error);
        }
      } catch (error) {
        handlers.onError?.(
          error instanceof Error ? error.message : 'Failed to parse buyer agent stream.',
        );
      }
    }
  }
}

export type RunBuyerRuntimeTaskParams = {
  prompt: string;
  sessionId: string;
  subjectId: string;
  walletAddress?: string | null;
  context?: Record<string, unknown>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
} & AgentStreamHandlers;

/** POST /api/agent/buyer and consume the SSE stream. */
export async function runBuyerRuntimeTask(params: RunBuyerRuntimeTaskParams): Promise<void> {
  const response = await fetch(buildAgentControlPlaneUrl('/api/agent/buyer'), {
    method: 'POST',
    signal: params.signal,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': params.subjectId,
      ...(params.walletAddress ? { 'X-Wallet-Address': params.walletAddress } : {}),
      ...params.headers,
    },
    body: JSON.stringify({
      prompt: params.prompt,
      sessionId: params.sessionId,
      context: params.context ?? {},
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body returned by the buyer agent.');
  }

  await consumeAgentSseStream(reader, params, params.signal);
}
