import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  ChatLayout,
  PageLayout,
  PageHeader,
  Textarea,
} from '@portfolio-ui';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useAgentRuntime, useCart, useSubject, useTrustState } from '@/hooks';
import { TrustNotice } from '@/components/TrustStatus';
import { getMockBuyerItems } from '@/lib/mockSearch';
import { listDemoOrders } from '@/lib/localOrders';
import {
  applyBuyerAgentEnvelope,
  buildBuyerAgentSnapshot,
  extractBuyerAgentEnvelope,
} from '@/lib/agentBuyerState';
import type { BuyerAgentAction, BuyerAgentSnapshot } from '@/types/agent';

interface BuyerChatMessage {
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: number;
}

interface PersistedBuyerAgentUiState {
  messages: BuyerChatMessage[];
  latestSummary: string;
  latestActions: BuyerAgentAction[];
  trustBlockReason: string | null;
}

const SESSION_STORAGE_KEY = 'portfolio-agent-session-id:/api/agent/buyer';
const BUYER_AGENT_UI_STATE_KEY = 'ondc-buyer-agent-ui-state';

function getStoredSessionId() {
  if (typeof window === 'undefined') {
    return `session-${Date.now()}`;
  }

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  window.localStorage.setItem(SESSION_STORAGE_KEY, created);
  return created;
}

function readPersistedUiState(): PersistedBuyerAgentUiState {
  if (typeof window === 'undefined') {
    return {
      messages: [],
      latestSummary: '',
      latestActions: [],
      trustBlockReason: null,
    };
  }

  try {
    const raw = window.localStorage.getItem(BUYER_AGENT_UI_STATE_KEY);
    if (!raw) {
      return {
        messages: [],
        latestSummary: '',
        latestActions: [],
        trustBlockReason: null,
      };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedBuyerAgentUiState> | null;
    return {
      messages: Array.isArray(parsed?.messages) ? parsed.messages : [],
      latestSummary: typeof parsed?.latestSummary === 'string' ? parsed.latestSummary : '',
      latestActions: Array.isArray(parsed?.latestActions) ? (parsed.latestActions as BuyerAgentAction[]) : [],
      trustBlockReason: typeof parsed?.trustBlockReason === 'string' ? parsed.trustBlockReason : null,
    };
  } catch {
    return {
      messages: [],
      latestSummary: '',
      latestActions: [],
      trustBlockReason: null,
    };
  }
}

function persistUiState(state: PersistedBuyerAgentUiState) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(BUYER_AGENT_UI_STATE_KEY, JSON.stringify(state));
}

function describeAction(action: BuyerAgentAction) {
  switch (action.type) {
    case 'recommend_item':
      return `Recommend ${action.item_id}: ${action.reason}`;
    case 'cart_add':
      return `Add ${action.item_id} x${action.quantity} to cart`;
    case 'navigate':
      return `Navigate to ${action.path}`;
    case 'trust_required':
      return `Trust required for ${action.operation}`;
    case 'unsupported':
      return action.reason;
    default:
      return 'Buyer agent action';
  }
}

function toneForAction(action: BuyerAgentAction) {
  if (action.type === 'trust_required') return 'warning' as const;
  if (action.type === 'unsupported') return 'error' as const;
  return 'info' as const;
}

async function processBuyerStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: {
    onDelta: () => void;
    onResult: (content: string) => Promise<void> | void;
    onError: (error: string) => void;
    onDone: () => void;
  },
) {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      handlers.onDone();
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) {
        continue;
      }

      const data = line.replace(/^data:\s*/, '').trim();
      if (!data || data === '[DONE]') {
        continue;
      }

      try {
        const event = JSON.parse(data) as { type?: string; content?: string; error?: string };
        if (event.type === 'assistant_delta') {
          handlers.onDelta();
        } else if (event.type === 'result' && typeof event.content === 'string') {
          await handlers.onResult(event.content);
        } else if (event.type === 'error' && typeof event.error === 'string') {
          handlers.onError(event.error);
        }
      } catch (error) {
        handlers.onError(error instanceof Error ? error.message : 'Failed to parse buyer agent stream.');
      }
    }
  }
}

function SnapshotCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Card className="space-y-2">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">{label}</div>
      <div className="text-3xl font-bold tracking-[-0.04em] text-[var(--ui-text)]">{value}</div>
      <div className="text-sm text-[var(--ui-text-secondary)]">{helper}</div>
    </Card>
  );
}

function SnapshotPanel({ snapshot }: { snapshot: BuyerAgentSnapshot }) {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <SnapshotCard
        label="Catalog"
        value={String(snapshot.catalog.total_items)}
        helper="Mock buyer inventory available to the Claude tool layer."
      />
      <SnapshotCard
        label="Cart"
        value={String(snapshot.cart.item_count)}
        helper={`${snapshot.cart.subtotal} subtotal`}
      />
      <SnapshotCard
        label="Orders"
        value={String(snapshot.orders.total)}
        helper={snapshot.orders.total ? 'Recent local orders are available for follow-up.' : 'No recent buyer orders stored locally.'}
      />
      <SnapshotCard
        label="Route"
        value={snapshot.route.path}
        helper={snapshot.trust.write_enabled ? 'Checkout routing may execute.' : 'Checkout routing is guidance-only until trust verifies.'}
      />
    </div>
  );
}

export function AgentChatPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { walletAddress, subjectId, authLoading } = useSubject();
  const trust = useTrustState(walletAddress);
  const runtime = useAgentRuntime(subjectId, walletAddress);
  const { session: cartSession, addToCart } = useCart();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<BuyerChatMessage[]>(() => readPersistedUiState().messages);
  const [latestSummary, setLatestSummary] = useState(() => readPersistedUiState().latestSummary);
  const [latestActions, setLatestActions] = useState<BuyerAgentAction[]>(() => readPersistedUiState().latestActions);
  const [trustBlockReason, setTrustBlockReason] = useState<string | null>(() => readPersistedUiState().trustBlockReason);

  const sessionIdRef = useRef(getStoredSessionId());
  const messagesRef = useRef(messages);
  const latestSummaryRef = useRef(latestSummary);
  const latestActionsRef = useRef(latestActions);
  const trustBlockReasonRef = useRef(trustBlockReason);

  const showAgent = Boolean(subjectId) && runtime.agent_access;
  const usageLabel =
    runtime.usage.requests_limit > 0
      ? `Usage ${runtime.usage.requests_used}/${runtime.usage.requests_limit}`
      : `${runtime.usage.requests_used} requests this period`;

  const snapshot = useMemo(
    () =>
      buildBuyerAgentSnapshot(
        { path: location.pathname, search: location.search },
        trust.state,
        cartSession,
        getMockBuyerItems(),
        listDemoOrders(),
      ),
    [cartSession, location.pathname, location.search, trust.state],
  );

  function commitUiState(next: PersistedBuyerAgentUiState) {
    messagesRef.current = next.messages;
    latestSummaryRef.current = next.latestSummary;
    latestActionsRef.current = next.latestActions;
    trustBlockReasonRef.current = next.trustBlockReason;
    setMessages(next.messages);
    setLatestSummary(next.latestSummary);
    setLatestActions(next.latestActions);
    setTrustBlockReason(next.trustBlockReason);
    persistUiState(next);
  }

  async function sendMessage() {
    const prompt = input.trim();
    if (!prompt || isLoading || !subjectId) {
      return;
    }

    const nextUserMessages: BuyerChatMessage[] = [
      ...messagesRef.current,
      {
        role: 'user',
        content: prompt,
        timestamp: Date.now(),
      },
    ];

    commitUiState({
      messages: nextUserMessages,
      latestSummary: latestSummaryRef.current,
      latestActions: latestActionsRef.current,
      trustBlockReason: null,
    });
    setInput('');
    setIsLoading(true);
    setStreaming(false);
    setTrustBlockReason(null);

    try {
      const response = await fetch('/api/agent/buyer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': subjectId,
          ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
        },
        body: JSON.stringify({
          prompt,
          sessionId: sessionIdRef.current,
          context: {
            buyer_snapshot: snapshot,
            response_contract: 'buyer_agent_v1',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body returned by the buyer agent.');
      }

      await processBuyerStream(reader, {
        onDelta: () => setStreaming(true),
        onResult: async (content) => {
          const envelope = extractBuyerAgentEnvelope(content);
          if (!envelope) {
            commitUiState({
              messages: [
                ...messagesRef.current,
                {
                  role: 'assistant',
                  content,
                  timestamp: Date.now(),
                },
              ],
              latestSummary: content,
              latestActions: [],
              trustBlockReason: null,
            });
            return;
          }

          const result = applyBuyerAgentEnvelope(envelope, snapshot, trust.state);
          for (const item of result.itemsToAdd) {
            await addToCart(item.item, item.quantity);
          }

          commitUiState({
            messages: [
              ...messagesRef.current,
              {
                role: 'assistant',
                content: result.summary,
                timestamp: Date.now(),
              },
            ],
            latestSummary: result.summary,
            latestActions: result.actions,
            trustBlockReason: result.trustBlockReason,
          });

          if (result.navigateTo) {
            navigate(result.navigateTo);
          }
        },
        onError: (error) => {
          commitUiState({
            messages: [
              ...messagesRef.current,
              {
                role: 'error',
                content: error,
                timestamp: Date.now(),
              },
            ],
            latestSummary: latestSummaryRef.current,
            latestActions: latestActionsRef.current,
            trustBlockReason: trustBlockReasonRef.current,
          });
        },
        onDone: () => {
          setStreaming(false);
          setIsLoading(false);
        },
      });
    } catch (error) {
      commitUiState({
        messages: [
          ...messagesRef.current,
          {
            role: 'error',
            content: error instanceof Error ? error.message : 'Buyer agent request failed.',
            timestamp: Date.now(),
          },
        ],
        latestSummary: latestSummaryRef.current,
        latestActions: latestActionsRef.current,
        trustBlockReason: trustBlockReasonRef.current,
      });
      setStreaming(false);
      setIsLoading(false);
    }
  }

  useEffect(() => {
    messagesRef.current = messages;
    latestSummaryRef.current = latestSummary;
    latestActionsRef.current = latestActions;
    trustBlockReasonRef.current = trustBlockReason;
    persistUiState({
      messages,
      latestSummary,
      latestActions,
      trustBlockReason,
    });
  }, [latestActions, latestSummary, messages, trustBlockReason]);

  return (
    <PageLayout>
      <PageHeader
        title="Buyer Agent Assistant"
        subtitle="Use the buyer cockpit to search, compare, add items to cart, and route into checkout with trust-aware execution."
      />

      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Badge tone={runtime.runtime_available ? 'success' : 'warning'}>Runtime {runtime.auth_mode}</Badge>
          <Badge tone={trust.state === 'verified' ? 'success' : 'warning'}>
            {trust.state === 'verified' ? 'High-trust write access enabled' : 'Read-only buyer guidance'}
          </Badge>
          <Badge tone="info">{runtime.model}</Badge>
          <Badge tone="info">{usageLabel}</Badge>
        </div>

        {!subjectId && !authLoading ? (
          <Alert
            tone="warning"
            title="Authentication required"
            description="Sign in to AadhaarChain or connect a wallet-backed identity before starting a buyer agent session."
          />
        ) : null}

        {subjectId && !runtime.runtime_available ? (
          <Alert
            tone="warning"
            title="Claude runtime unavailable"
            description={runtime.blocked_reason ?? 'Configure supported Claude Agent SDK auth or use the local Claude CLI dev adapter on localhost.'}
          />
        ) : null}

        {subjectId && runtime.agent_access && trust.state !== 'verified' ? (
          <TrustNotice
            state={trust.state}
            loading={trust.loading}
            error={trust.error}
            reason={trust.reason}
            actionLabel="Verify in AadhaarChain"
          />
        ) : null}

        <SnapshotPanel snapshot={snapshot} />

        {showAgent ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
            <ChatLayout
              title="Buyer Agent"
              actions={<Badge tone="info">Session: {sessionIdRef.current.slice(0, 12)}</Badge>}
              footer={
                <div className="space-y-2">
                  <div className="flex items-end gap-3">
                    <Textarea
                      value={input}
                      aria-label="Buyer agent prompt"
                      name="buyer-agent-prompt"
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                      placeholder="e.g., Find cold pressed mustard oil, add the best option to cart, and route me to checkout if trust allows."
                      className="min-h-[88px]"
                    />
                    <Button
                      type="button"
                      size="icon"
                      className="h-12 w-12 shrink-0"
                      onClick={() => void sendMessage()}
                      disabled={!input.trim() || isLoading}
                      aria-label={isLoading ? 'Buyer agent is responding' : 'Send buyer agent prompt'}
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-[var(--ui-text-muted)]">
                    Claude uses a locked-down buyer tool layer for search, product detail, cart state, order status, and trust-aware checkout guidance.
                  </p>
                </div>
              }
            >
              {messages.length === 0 ? (
                <Card className="border-dashed bg-[rgba(255,255,255,0.46)]">
                  <div className="space-y-2">
                    <div className="text-lg font-bold tracking-[-0.03em] text-[var(--ui-text)]">Start a buyer run</div>
                    <p className="text-sm text-[var(--ui-text-secondary)]">
                      Ask the agent to find an item, compare options, add a selected item to the cart, or move you toward checkout when the trust state permits it.
                    </p>
                  </div>
                </Card>
              ) : null}

              <div className="space-y-3">
                {messages.map((message) => (
                  <Card key={`${message.timestamp}-${message.role}`} className={message.role === 'user' ? 'border-[var(--ui-primary)] bg-[rgba(234,106,42,0.08)]' : undefined}>
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--ui-text-muted)]">
                        {message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Buyer Agent' : 'Error'}
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-[var(--ui-text)]">{message.content}</p>
                    </div>
                  </Card>
                ))}
              </div>

              {streaming ? (
                <div className="text-sm font-medium text-[var(--ui-text-secondary)]">Thinking...</div>
              ) : null}
            </ChatLayout>

            <div className="space-y-4">
              <Card className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">Latest buyer brief</div>
                <div className="text-base font-semibold tracking-[-0.02em] text-[var(--ui-text)]">
                  {latestSummary || 'The buyer agent summary will appear here after the first action run.'}
                </div>
                <div className="text-sm text-[var(--ui-text-secondary)]">
                  The brief reflects the structured result after Claude uses the locked-down buyer tool layer.
                </div>
              </Card>

              {trustBlockReason ? (
                <Alert
                  tone="warning"
                  title="Checkout still gated"
                  description={trustBlockReason}
                />
              ) : null}

              <Card className="space-y-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">Pending actions</div>
                  <div className="mt-1 text-sm text-[var(--ui-text-secondary)]">
                    Structured actions from the Claude result are shown here before or after local application.
                  </div>
                </div>
                <div className="space-y-2">
                  {latestActions.length ? latestActions.map((action, index) => (
                    <div
                      key={`${action.type}-${index}`}
                      className="rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[rgba(255,255,255,0.62)] px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-[var(--ui-text)]">{describeAction(action)}</div>
                        <Badge tone={toneForAction(action)}>{action.type}</Badge>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-[var(--ui-radius-lg)] border border-dashed border-[var(--ui-border)] px-4 py-3 text-sm text-[var(--ui-text-secondary)]">
                      No structured buyer actions yet.
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </PageLayout>
  );
}
