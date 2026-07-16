import { TRUST_API_URL } from './identityUrls';

export type SamanthaTranscriptEventType =
  | 'session_started'
  | 'session_stopped'
  | 'user_text'
  | 'user_voice_transcript'
  | 'assistant_text'
  | 'tool_call'
  | 'tool_result'
  | 'error';

export function createSamanthaSessionId(role: 'buyer' | 'seller'): string {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `samantha-${role}-${id}`;
}

export async function persistSamanthaEvent(input: {
  role: 'buyer' | 'seller';
  sessionId: string;
  eventType: SamanthaTranscriptEventType;
  content?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const response = await fetch(`${TRUST_API_URL}/api/realtime/transcripts/events`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: input.role,
      session_id: input.sessionId,
      event_type: input.eventType,
      content: input.content || '',
      metadata: input.metadata || {},
    }),
  });
  if (!response.ok) throw new Error(`Transcript persistence failed (${response.status})`);
}
