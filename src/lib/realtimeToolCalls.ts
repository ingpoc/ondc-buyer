/** Extract function tool calls from OpenAI Realtime data-channel events. */

export type RealtimeToolCall = {
  name: string;
  call_id: string;
  arguments: string;
};

function normalizeArgs(args: unknown): string {
  if (typeof args === 'string') return args || '{}';
  if (args && typeof args === 'object') {
    try {
      return JSON.stringify(args);
    } catch {
      return '{}';
    }
  }
  return '{}';
}

function pushCall(
  out: RealtimeToolCall[],
  seen: Set<string>,
  name: unknown,
  callId: unknown,
  args: unknown,
) {
  if (typeof name !== 'string' || !name) return;
  const id =
    typeof callId === 'string' && callId
      ? callId
      : null;
  if (!id) return;
  if (seen.has(id)) return;
  seen.add(id);
  out.push({
    name,
    call_id: id,
    arguments: normalizeArgs(args),
  });
}

/** Accept classic top-level fields or GA nested `item` / `id` shapes. */
function pushFromRecord(
  out: RealtimeToolCall[],
  seen: Set<string>,
  record: Record<string, unknown> | null | undefined,
) {
  if (!record || typeof record !== 'object') return;
  const name = record.name;
  const callId = record.call_id ?? record.id;
  const args = record.arguments;
  if (name != null && (callId != null || args !== undefined)) {
    pushCall(out, seen, name, callId, args);
  }
}

function scanItem(
  out: RealtimeToolCall[],
  seen: Set<string>,
  item: Record<string, unknown> | null | undefined,
) {
  if (!item || typeof item !== 'object') return;
  const type = item.type;
  // Only execute completed function calls — ignore message / reasoning items.
  if (type === 'function_call' || type === undefined) {
    pushFromRecord(out, seen, item);
  }
}

export function extractRealtimeToolCalls(msg: unknown): RealtimeToolCall[] {
  if (!msg || typeof msg !== 'object') return [];
  const m = msg as Record<string, unknown>;
  const out: RealtimeToolCall[] = [];
  const seen = new Set<string>();

  // Classic Realtime: top-level name/call_id/arguments.
  // GA / Responses-shaped: fields live under `item` (name, arguments, id|call_id).
  if (m.type === 'response.function_call_arguments.done') {
    pushFromRecord(out, seen, m);
    pushFromRecord(out, seen, m.item as Record<string, unknown> | undefined);
  }

  if (m.name && (m.call_id || m.id) && (m.arguments !== undefined || m.type === 'function_call')) {
    pushCall(out, seen, m.name, m.call_id ?? m.id, m.arguments);
  }

  // Only completed items — never output_item.added (args may still be streaming).
  if (
    m.type === 'response.output_item.done' ||
    m.type === 'conversation.item.done'
  ) {
    scanItem(out, seen, m.item as Record<string, unknown> | undefined);
  }

  return out;
}
