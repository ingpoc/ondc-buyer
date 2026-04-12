import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useAgentRuntime, useCart, useSubject, useTrustState } from '../hooks';
import { TrustNotice } from '../components/TrustStatus';
import { getMockBuyerItems } from '../lib/mockSearch';
import { listDemoOrders } from '../lib/localOrders';
import {
  applyBuyerAgentEnvelope,
  buildBuyerAgentSnapshot,
  extractBuyerAgentEnvelope,
} from '../lib/agentBuyerState';
import type { BuyerAgentAction, BuyerAgentSnapshot } from '../types/agent';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';

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

function actionBadgeClass(action: BuyerAgentAction) {
  if (action.type === 'trust_required') return 'bg-amber-100 text-amber-800';
  if (action.type === 'unsupported') return 'bg-rose-100 text-rose-800';
  return 'bg-lime-50 text-lime-900';
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
        handlers.onError(
          error instanceof Error
            ? error.message
            : 'Failed to parse buyer agent stream.',
        );
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
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
        <CardTitle className="text-3xl tracking-tight">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{helper}</CardContent>
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
        helper={
          snapshot.orders.total
            ? 'Recent local orders are available for follow-up.'
            : 'No recent buyer orders stored locally.'
        }
      />
      <SnapshotCard
        label="Route"
        value={snapshot.route.path}
        helper={
          snapshot.trust.write_enabled
            ? 'Checkout routing may execute.'
            : 'Checkout routing is guidance-only until trust verifies.'
        }
      />
    </div>
  );
}

function NoticeCard({
  title,
  description,
  tone = 'warning',
}: {
  title: string;
  description: string;
  tone?: 'warning' | 'error' | 'info';
}) {
  const toneClass =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : tone === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-900'
        : 'border-blue-200 bg-blue-50 text-blue-900';

  return (
    <Card className={`${toneClass} shadow-none`}>
      <CardContent className="space-y-2 py-5">
        <div className="text-sm font-semibold">{title}</div>
        <p className="text-sm leading-6">{description}</p>
      </CardContent>
    </Card>
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
  const [messages, setMessages] = useState<BuyerChatMessage[]>(
    () => readPersistedUiState().messages,
  );
  const [latestSummary, setLatestSummary] = useState(
    () => readPersistedUiState().latestSummary,
  );
  const [latestActions, setLatestActions] = useState<BuyerAgentAction[]>(
    () => readPersistedUiState().latestActions,
  );
  const [trustBlockReason, setTrustBlockReason] = useState<string | null>(
    () => readPersistedUiState().trustBlockReason,
  );

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
          setIsLoading(false);
          setStreaming(false);
        },
      });
    } catch (error) {
      commitUiState({
        messages: [
          ...messagesRef.current,
          {
            role: 'error',
            content:
              error instanceof Error
                ? error.message
                : 'Buyer agent request failed.',
            timestamp: Date.now(),
          },
        ],
        latestSummary: latestSummaryRef.current,
        latestActions: latestActionsRef.current,
        trustBlockReason: trustBlockReasonRef.current,
      });
      setIsLoading(false);
      setStreaming(false);
    }
  }

  useEffect(() => {
    messagesRef.current = messages;
    latestSummaryRef.current = latestSummary;
    latestActionsRef.current = latestActions;
    trustBlockReasonRef.current = trustBlockReason;
  }, [latestActions, latestSummary, messages, trustBlockReason]);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Buyer agent
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Buyer agent assistant
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          Use the buyer cockpit to search, compare, add items to cart, and route into checkout
          with trust-aware execution.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <Badge
          variant="secondary"
          className={
            runtime.runtime_available
              ? 'rounded-full bg-lime-100 text-lime-900'
              : 'rounded-full bg-secondary text-secondary-foreground'
          }
        >
          Runtime {runtime.auth_mode}
        </Badge>
        <Badge
          variant="secondary"
          className={
            trust.state === 'verified'
              ? 'rounded-full bg-lime-100 text-lime-900'
              : 'rounded-full bg-secondary text-secondary-foreground'
          }
        >
          {trust.state === 'verified'
            ? 'High-trust write access enabled'
            : 'Read-only buyer guidance'}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          {runtime.model}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          {usageLabel}
        </Badge>
      </div>

      {!subjectId && !authLoading ? (
        <NoticeCard
          title="Authentication required"
          description="Sign in to AadhaarChain or connect a wallet-backed identity before starting a buyer agent session."
        />
      ) : null}

      {subjectId && !runtime.runtime_available ? (
        <NoticeCard
          title="Claude runtime unavailable"
          description={
            runtime.blocked_reason ??
            'Configure supported Claude Agent SDK auth or use the local Claude CLI dev adapter on localhost.'
          }
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
          <Card className="border-border/70 bg-card/95 shadow-md">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Buyer agent
                </div>
                <CardTitle className="text-2xl">Locked-down buyer tool run</CardTitle>
              </div>
              <Badge variant="outline" className="rounded-full">
                Session: {sessionIdRef.current.slice(0, 12)}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {messages.length === 0 ? (
                <Card className="border-dashed border-border/70 bg-background/60 shadow-none">
                  <CardContent className="space-y-2 py-6">
                    <div className="text-lg font-semibold">Start a buyer run</div>
                    <p className="text-sm text-muted-foreground">
                      Ask the agent to find an item, compare options, add a selected item to the
                      cart, or move you toward checkout when the trust state permits it.
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              <div className="space-y-3">
                {messages.map((message) => (
                  <Card
                    key={`${message.timestamp}-${message.role}`}
                    className={
                      message.role === 'user'
                        ? 'border-primary/30 bg-primary/5 shadow-none'
                        : message.role === 'error'
                          ? 'border-rose-200 bg-rose-50 shadow-none'
                          : 'border-border/70 bg-card/90 shadow-none'
                    }
                  >
                    <CardContent className="space-y-2 py-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        {message.role === 'user'
                          ? 'You'
                          : message.role === 'assistant'
                            ? 'Buyer agent'
                            : 'Error'}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {message.content}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {streaming ? (
                <div className="text-sm font-medium text-muted-foreground">Thinking...</div>
              ) : null}
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-3 border-t border-border/70 pt-5">
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
                  className="min-h-[96px]"
                />
                <Button
                  type="button"
                  size="icon-lg"
                  className="shrink-0 rounded-full"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || isLoading}
                  aria-label={isLoading ? 'Buyer agent is responding' : 'Send buyer agent prompt'}
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowRight className="size-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Claude uses a locked-down buyer tool layer for search, product detail, cart state,
                order status, and trust-aware checkout guidance.
              </p>
            </CardFooter>
          </Card>

          <div className="space-y-4">
            <Card className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Latest buyer brief
                </div>
                <CardTitle className="text-xl">
                  {latestSummary || 'The buyer agent summary will appear here after the first action run.'}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                The brief reflects the structured result after Claude uses the locked-down buyer
                tool layer.
              </CardContent>
            </Card>

            {trustBlockReason ? (
              <NoticeCard
                title="Checkout still gated"
                description={trustBlockReason}
              />
            ) : null}

            <Card className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Pending actions
                </div>
                <CardTitle className="text-xl">Structured follow-up</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {latestActions.length ? (
                  latestActions.map((action, index) => (
                    <div
                      key={`${action.type}-${index}`}
                      className="rounded-3xl border border-border/70 bg-background/70 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-foreground">
                          {describeAction(action)}
                        </div>
                        <Badge
                          variant="secondary"
                          className={`rounded-full ${actionBadgeClass(action)}`}
                        >
                          {action.type}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-border/70 px-4 py-3 text-sm text-muted-foreground">
                    No structured buyer actions yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
