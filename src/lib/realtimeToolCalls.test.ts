import { describe, expect, it } from 'vitest';
import { extractRealtimeToolCalls } from './realtimeToolCalls';

describe('extractRealtimeToolCalls', () => {
  it('reads classic top-level function_call_arguments.done', () => {
    const calls = extractRealtimeToolCalls({
      type: 'response.function_call_arguments.done',
      name: 'search_catalog',
      call_id: 'call_classic',
      arguments: '{"query":"banana"}',
    });
    expect(calls).toEqual([
      {
        name: 'search_catalog',
        call_id: 'call_classic',
        arguments: '{"query":"banana"}',
      },
    ]);
  });

  it('reads GA nested item on function_call_arguments.done (id, no top-level name)', () => {
    const calls = extractRealtimeToolCalls({
      type: 'response.function_call_arguments.done',
      response_id: 'resp_1',
      output_index: 0,
      item: {
        type: 'function_call',
        id: 'fc_nested',
        name: 'search_catalog',
        arguments: '{"query":"banana"}',
      },
    });
    expect(calls).toEqual([
      {
        name: 'search_catalog',
        call_id: 'fc_nested',
        arguments: '{"query":"banana"}',
      },
    ]);
  });

  it('prefers call_id over id when both present on item', () => {
    const calls = extractRealtimeToolCalls({
      type: 'response.function_call_arguments.done',
      item: {
        type: 'function_call',
        id: 'fc_item',
        call_id: 'call_preferred',
        name: 'add_to_cart',
        arguments: { item_id: 'banana-robusta-dozen' },
      },
    });
    expect(calls[0]?.call_id).toBe('call_preferred');
    expect(calls[0]?.arguments).toContain('banana-robusta-dozen');
  });

  it('extracts function_call from response.output_item.done', () => {
    const calls = extractRealtimeToolCalls({
      type: 'response.output_item.done',
      item: {
        type: 'function_call',
        name: 'navigate_to',
        call_id: 'call_nav',
        arguments: '{"path":"/cart"}',
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('navigate_to');
  });

  it('does not execute incomplete output_item.added alone without args done', () => {
    const calls = extractRealtimeToolCalls({
      type: 'response.output_item.added',
      item: {
        type: 'function_call',
        name: 'search_catalog',
        call_id: 'call_early',
        arguments: '',
      },
    });
    // added is ignored; empty arguments would be useless anyway
    expect(calls).toEqual([]);
  });

  it('ignores non-function output items', () => {
    const calls = extractRealtimeToolCalls({
      type: 'response.output_item.done',
      item: { type: 'message', id: 'msg_1', content: [] },
    });
    expect(calls).toEqual([]);
  });
});
