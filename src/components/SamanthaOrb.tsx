import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TRUST_API_URL } from '../lib/identityUrls';
import {
  BUYER_TOOL_DEFINITIONS,
  coerceBuyerNavPath,
  resolveBuyerAddTarget,
  runBuyerTool,
  type BuyerToolName,
} from '../lib/agentTools';
import { listBuyerCatalogItems } from '../lib/buyerCatalogCache';
import { extractRealtimeToolCalls } from '../lib/realtimeToolCalls';
import { formatMemoryForPrompt, loadSamanthaMemory } from '../lib/samanthaMemory';
import { subscribeBuyerRuntimeJob } from '../lib/samanthaRuntimeHandoff';
import { useCart, useSubject } from '../hooks';
import { getMockBuyerItems } from '../lib/mockSearch';
import { cn } from '../lib/utils';

const BUYER_ORB_INSTRUCTIONS =
  'You are Samantha, the ONDC Buyer shopping companion. Speak briefly and warmly. Keep every user-facing reply to at most two short sentences unless the user asks for detail. ' +
  'The user must SEE the app move with their ask — never do shopping work only in the background. ' +
  'Interpret intent, then call tools immediately. Narrate briefly while tools run (e.g. “Opening results for bananas…”). ' +
  'Greetings or chitchat: reply briefly with NO tools. Do not volunteer work they did not ask for. ' +
  'Find / search / show products: call search_catalog — it opens /results so they watch offers load. ' +
  'Open cart / checkout / orders / config: call navigate_to to that path so the page changes. ' +
  'Add to cart: if Host context lists cached offers OR /results already shows offers, call add_to_cart immediately with item_id or query — never claim the catalog is empty when Host context has items, and do NOT search again. ' +
  'Only search_catalog before add when there is no Host context and no results yet. They land on /cart with the line visible. ' +
  'Checkout or pay: call checkout_commit (host fills cart total and session_id). Report AgentGuard allow / need_approval / deny honestly. ' +
  'Never ask for session ID, cart total, or amount_inr. ' +
  'Chain short tools in one turn when needed. Continue after each function_call_output until the short request is done. ' +
  'If the user asks for cart/checkout/orders while a search is running, call navigate_to and STOP — do not retry search_catalog after a timeout or navSuperseded. ' +
  'Long planning (weekly plan, budget, research): call delegate_to_runtime_agent once; say you started and will update them — never mention Cursor or /agent. ' +
  'Never invent work. Short tools: search_catalog, navigate_to, add_to_cart, remember_preference, checkout_commit.';

function buildOutboundUserText(userText: string): string {
  const cached = listBuyerCatalogItems()
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      name: item.name || item.descriptor?.name || item.id,
      price_inr: item.price?.value,
    }));
  if (!cached.length) return userText;
  return (
    `${userText}\n\n` +
    `[Host context — visible results cache (not typed by the user): ${JSON.stringify(cached)}. ` +
    'If they asked to add an item, call add_to_cart now using an id or query from this list.]'
  );
}

type OrbState = 'idle' | 'connecting' | 'listening' | 'error';

function replyForDisplay(text: string): string {
  return text
    .split('\n')
    .filter((line) => !/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line))
    .join('\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\s*\|\s*/g, ' · ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function createSilentAudioTrack(): MediaStreamTrack {
  const ctx = new AudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  oscillator.connect(gain);
  const dest = ctx.createMediaStreamDestination();
  gain.connect(dest);
  oscillator.start();
  const track = dest.stream.getAudioTracks()[0];
  track.enabled = true;
  return track;
}

/**
 * Non-blocking Samantha orb — voice and compact text chat for testing.
 */
const COMMITTED_PATHS = ['/cart', '/checkout', '/orders', '/config'];

function isCommittedBuyerPath(pathname: string): boolean {
  return COMMITTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function SamanthaOrb() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;
  const { subjectId, walletAddress } = useSubject();
  const { addToCart, session, subtotal, refreshCart } = useCart();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<OrbState>('idle');
  const [hint, setHint] = useState('Tap for Samantha (voice or text)');
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState('');
  /** null = status not loaded yet (do not treat as missing OpenAI key). */
  const [configured, setConfigured] = useState<boolean | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const handledCallsRef = useRef<Set<string>>(new Set());
  const replyBufRef = useRef('');
  /** Queued while connecting — flushed when Realtime is listening. */
  const pendingTextRef = useRef<string | null>(null);
  /** Bumped when a non-search tool moves the UI — stale search navigateTo must not yank back. */
  const navEpochRef = useRef(0);
  // Realtime dc.onmessage closes over wire-time handlers; always call latest.
  const handleToolCallRef = useRef<
    (name: string, callId: string, argsJson: string) => Promise<void>
  >(async () => undefined);

  useEffect(() => {
    return subscribeBuyerRuntimeJob((update) => {
      const w = window as Window & {
        __samanthaRuntimeJobs?: Array<Record<string, unknown>>;
      };
      w.__samanthaRuntimeJobs = w.__samanthaRuntimeJobs || [];
      w.__samanthaRuntimeJobs.push({ ...update, at: new Date().toISOString() });
      w.__samanthaRuntimeJobs = w.__samanthaRuntimeJobs.slice(-20);
      if (update.status === 'started') {
        setHint(update.summary || "I've started that — I'll let you know when it's done.");
        setOpen(true);
        return;
      }
      if (update.status === 'busy') {
        setHint(update.error || "I'm still working on that.");
        setOpen(true);
        return;
      }
      const note =
        update.status === 'completed'
          ? update.summary || 'All done.'
          : update.summary || update.error || "Sorry — that didn't finish.";
      setHint(
        update.status === 'completed'
          ? 'Background task complete'
          : 'Background task could not finish'
      );
      setReply(note);
      setOpen(true);
      const dc = dcRef.current;
      if (!dc || dc.readyState !== 'open') return;
      try {
        dc.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text:
                    update.status === 'completed'
                      ? `[Internal] Background work finished. Tell the user briefly: ${note}`
                      : `[Internal] Background work failed. Tell the user briefly: ${note}`,
                },
              ],
            },
          })
        );
        dc.send(JSON.stringify({ type: 'response.create' }));
      } catch {
        /* channel closed */
      }
    });
  }, []);

  async function probeRealtimeConfigured(retries = 3): Promise<boolean> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        const res = await fetch(`${TRUST_API_URL}/api/realtime/status`);
        const body = await res.json();
        const ok = Boolean(body?.data?.configured);
        setConfigured(ok);
        if (body?.data?.model) {
          setHint(`Samantha · ${body.data.model}`);
        }
        return ok;
      } catch (err) {
        lastErr = err;
        // Render Free cold start: brief backoff then retry.
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    setConfigured(false);
    if (lastErr) {
      setHint('Gateway unreachable — retry in a moment');
    }
    return false;
  }

  useEffect(() => {
    void probeRealtimeConfigured();
    return () => {
      stopSession();
    };
  }, []);

  const handleToolCall = useCallback(
    async (name: string, callId: string, argsJson: string) => {
      if (handledCallsRef.current.has(callId)) return;
      handledCallsRef.current.add(callId);
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(argsJson || '{}') as Record<string, unknown>;
      } catch {
        args = {};
      }
      if (name === 'add_to_cart') {
        // Network search_catalog returns empty ids (ACK-first). Resolve from ResultsPage cache.
        const resolved = await resolveBuyerAddTarget(args);
        if (resolved?.id) {
          args.item_id = resolved.id;
          if (!args.query && (args.name || args.product)) {
            args.query = String(args.name ?? args.product);
          }
        }
      }
      if (name === 'checkout_commit') {
        try {
          await refreshCart();
        } catch {
          /* best-effort */
        }
        if (!args.session_id) {
          const fromSession = session?.id;
          const fromStorage =
            typeof localStorage !== 'undefined' ? localStorage.getItem('ondc-session-id') : null;
          args.session_id = fromSession || fromStorage || `session-${Date.now()}`;
        }
        if (args.amount_inr == null || Number(args.amount_inr) <= 0) {
          const total = Number(subtotal) || 0;
          if (total > 0) {
            args.amount_inr = Math.round(total);
          }
        }
        if (!args.item_id && session?.items?.length) {
          const first = session.items[0];
          const firstId = first.item?.id;
          if (firstId) {
            args.item_id = firstId;
          }
          if (args.quantity == null) {
            args.quantity = first.quantity ?? 1;
          }
        }
      }

      // Visible journey: move the page as soon as the tool starts (before long network polls).
      const navEpochAtStart = navEpochRef.current;
      if (name === 'search_catalog') {
        const q = String(args.query ?? '').trim() || 'grocery';
        // Do not yank off cart/checkout/orders/config — navigate_to/add already won.
        // Intentional search from those pages still lands via result.navigateTo when not superseded.
        if (!isCommittedBuyerPath(locationRef.current)) {
          navigate(`/results?category=grocery&q=${encodeURIComponent(q)}`);
          setHint(`Searching for “${q}” — watch the results page…`);
        } else {
          setHint(`Searching for “${q}” — keeping you on ${locationRef.current}…`);
        }
        setOpen(true);
      } else if (name === 'navigate_to') {
        const path = coerceBuyerNavPath(String(args.path ?? args.page ?? args.destination ?? ''));
        if (path) {
          navEpochRef.current += 1;
          navigate(path);
          setHint(`Opening ${path}…`);
          setOpen(true);
        }
      }

      const result = await Promise.race([
        runBuyerTool(name as BuyerToolName, args, {
          walletAddress: walletAddress || '',
          subjectId: subjectId || '',
        }),
        new Promise<Awaited<ReturnType<typeof runBuyerTool>>>((resolve) => {
          window.setTimeout(() => {
            const superseded = name === 'search_catalog' && navEpochRef.current !== navEpochAtStart;
            resolve({
              ok: false,
              tool: name as BuyerToolName,
              message: superseded
                ? 'Search timed out after you already moved — staying on your current page. Do not retry search unless the user asks again.'
                : 'That took too long on my side — the page may still be updating. Try again or tell me what you see.',
              navigateTo:
                name === 'search_catalog' && !superseded
                  ? `/results?category=grocery&q=${encodeURIComponent(String(args.query ?? '').trim() || 'grocery')}`
                  : undefined,
            });
          }, 12_000);
        }),
      ]);
      const navSuperseded = name === 'search_catalog' && navEpochRef.current !== navEpochAtStart;
      const hostMessage = navSuperseded
        ? 'Search finished but you already navigated away — left you on your current page.'
        : result.message;
      setHint(hostMessage);
      // Evidence for Hermes / operators — tool applied in the UI host.
      try {
        const w = window as Window & {
          __samanthaTools?: Array<Record<string, unknown>>;
        };
        w.__samanthaTools = w.__samanthaTools || [];
        w.__samanthaTools.push({
          at: Date.now(),
          name,
          callId,
          ok: result.ok,
          message: hostMessage,
          decision: result.decision ?? null,
          receiptId: result.receiptId ?? null,
          navigateTo: navSuperseded ? null : (result.navigateTo ?? null),
          cartAdds: result.cartAdds?.map((a) => a.itemId) ?? [],
          amount_inr: args.amount_inr ?? null,
          session_id: args.session_id ?? null,
          navSuperseded,
        });
      } catch {
        /* ignore */
      }
      if (result.cartAdds?.length) {
        for (const add of result.cartAdds) {
          const match = add.item || getMockBuyerItems().find((item) => item.id === add.itemId);
          if (match) {
            await addToCart(match as Parameters<typeof addToCart>[0], add.quantity);
          } else {
            setHint(`Cart add failed: unknown ${add.itemId}`);
          }
        }
        navEpochRef.current += 1;
      }
      // Navigate after cart mutations so the destination page shows updated state.
      // Do not let a finishing search_catalog yank the user back off cart/checkout/etc.
      if (result.navigateTo && !navSuperseded) {
        if (name !== 'search_catalog') {
          navEpochRef.current += 1;
        }
        navigate(result.navigateTo);
      }
      if (name === 'checkout_commit') {
        try {
          await refreshCart();
        } catch {
          /* best-effort */
        }
      }
      const dc = dcRef.current;
      if (!dc || dc.readyState !== 'open') return;
      dc.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify({
              ok: result.ok,
              tool: result.tool,
              message: hostMessage,
              // Omit navigateTo when superseded so the model does not retry search→results.
              navigateTo: navSuperseded ? null : result.navigateTo,
              navSuperseded,
              cartAdds: result.cartAdds?.map((a) => ({
                itemId: a.itemId,
                quantity: a.quantity,
                name: a.item.name,
              })),
              decision: result.decision,
              receiptId: result.receiptId,
              data: result.data,
            }),
          },
        })
      );
      dc.send(JSON.stringify({ type: 'response.create' }));
    },
    [addToCart, navigate, refreshCart, session, subjectId, subtotal, walletAddress]
  );
  handleToolCallRef.current = handleToolCall;

  function stopSession() {
    const pc = pcRef.current;
    pcRef.current = null;
    dcRef.current = null;
    handledCallsRef.current.clear();
    replyBufRef.current = '';
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    try {
      pc?.getSenders().forEach((sender) => sender.track?.stop());
      pc?.close();
    } catch {
      /* already closed */
    }
    setState('idle');
  }

  function appendReply(chunk: string) {
    replyBufRef.current += chunk;
    setReply(replyBufRef.current.slice(0, 1200));
  }

  function wireDataChannel(dc: RTCDataChannel, model: string, usedMic: boolean) {
    dcRef.current = dc;
    dc.onopen = () => {
      if (pcRef.current == null) return;
      // GA Realtime: output_modalities is ["audio"] OR ["text"], not both.
      // Silent placeholder tracks must disable VAD or they auto-fire ghost turns.
      const session: Record<string, unknown> = {
        type: 'realtime',
        model,
        output_modalities: usedMic ? ['audio'] : ['text'],
        tools: BUYER_TOOL_DEFINITIONS,
        tool_choice: 'auto',
        parallel_tool_calls: true,
        instructions: BUYER_ORB_INSTRUCTIONS,
        audio: {
          input: {
            turn_detection: usedMic ? { type: 'semantic_vad' } : null,
          },
        },
      };
      dc.send(JSON.stringify({ type: 'session.update', session }));
      setHint(usedMic ? 'Connecting tools…' : 'Connecting text mode…');
    };
    dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type?: string;
          delta?: string;
          transcript?: string;
          text?: string;
          error?: { message?: string; code?: string };
          message?: string;
        };
        try {
          const w = window as Window & {
            __samanthaEvents?: string[];
            __samanthaErrors?: unknown[];
          };
          w.__samanthaEvents = w.__samanthaEvents || [];
          w.__samanthaErrors = w.__samanthaErrors || [];
          if (msg.type && w.__samanthaEvents.length < 120) {
            w.__samanthaEvents.push(msg.type);
          }
          if (msg.type === 'error') {
            w.__samanthaErrors.push(msg);
          }
        } catch {
          /* ignore */
        }
        if (msg.type === 'session.updated') {
          setState('listening');
          setHint(usedMic ? 'Listening + text ready' : 'Text mode ready (no mic)');
          const pending = pendingTextRef.current;
          if (pending && dc.readyState === 'open') {
            pendingTextRef.current = null;
            replyBufRef.current = '';
            setReply('');
            setDraft('');
            dc.send(
              JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'user',
                  content: [{ type: 'input_text', text: buildOutboundUserText(pending) }],
                },
              })
            );
            dc.send(JSON.stringify({ type: 'response.create' }));
            setHint('Samantha is thinking…');
          }
        }
        if (msg.type === 'error') {
          const detail = msg.error?.message || msg.message || msg.error?.code || 'session error';
          setState('error');
          setHint(`Samantha error: ${String(detail).slice(0, 160)}`);
        }
        if (
          msg.type === 'response.created' &&
          replyBufRef.current &&
          !/\s$/.test(replyBufRef.current)
        ) {
          replyBufRef.current += ' ';
        }
        if (
          msg.type === 'response.output_audio_transcript.delta' ||
          msg.type === 'response.audio_transcript.delta' ||
          msg.type === 'response.output_text.delta' ||
          msg.type === 'response.text.delta'
        ) {
          appendReply(String(msg.delta || msg.transcript || msg.text || ''));
        }
        if (
          msg.type === 'response.output_audio_transcript.done' ||
          msg.type === 'response.audio_transcript.done' ||
          msg.type === 'response.done'
        ) {
          // Do not clobber tool result hints (e.g. "Found 1 item…").
          if (replyBufRef.current.trim() && handledCallsRef.current.size === 0) {
            setHint('Samantha replied');
          }
        }
        const calls = extractRealtimeToolCalls(msg);
        if (calls.length === 0) return;
        void (async () => {
          for (const call of calls) {
            await handleToolCallRef.current(call.name, call.call_id, call.arguments);
          }
        })();
      } catch {
        /* ignore */
      }
    };
  }

  async function startSession() {
    if (state === 'listening' || state === 'connecting') return;
    setState('connecting');
    setHint('Connecting Samantha…');
    // Re-probe on open: avoids false "not configured" while status is still loading
    // or after a Free-tier cold start failed the mount-time fetch.
    const ready = configured === true ? true : await probeRealtimeConfigured();
    if (!ready) {
      setState('error');
      setHint('Realtime not configured on gateway');
      return;
    }
    setReply('');
    replyBufRef.current = '';
    const memory = loadSamanthaMemory(subjectId);
    const secretRes = await fetch(`${TRUST_API_URL}/api/realtime/client-secret`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'buyer',
        agent_name: 'Samantha',
        memory_prompt: formatMemoryForPrompt(memory),
      }),
    });
    const secretBody = await secretRes.json();
    if (!secretRes.ok || secretBody.success === false) {
      setState('error');
      setHint(String(secretBody.detail || 'Failed to start Samantha'));
      return;
    }
    const clientSecret =
      secretBody.data?.client_secret?.value ||
      secretBody.data?.client_secret ||
      secretBody.data?.raw?.value;
    if (!clientSecret || typeof clientSecret !== 'string') {
      setState('error');
      setHint('Bad client secret payload');
      return;
    }

    const pc = new RTCPeerConnection();
    pcRef.current = pc;
    const stillActive = () => pcRef.current === pc;
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audioRef.current = audio;
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0];
      void audio.play().catch(() => {
        setHint('Tap Send again if audio is blocked');
      });
    };

    let usedMic = false;
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!stillActive()) {
        ms.getTracks().forEach((t) => t.stop());
        return;
      }
      pc.addTrack(ms.getTracks()[0]);
      usedMic = true;
    } catch {
      if (!stillActive()) return;
      try {
        pc.addTrack(createSilentAudioTrack());
        setHint('Connecting text mode…');
      } catch {
        setState('error');
        setHint('Could not start audio channel');
        stopSession();
        return;
      }
    }

    const dc = pc.createDataChannel('oai-events');
    wireDataChannel(dc, secretBody.data?.model || 'gpt-realtime-2.1-mini', usedMic);

    const offer = await pc.createOffer();
    if (!stillActive()) return;
    await pc.setLocalDescription(offer);
    const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        'Content-Type': 'application/sdp',
      },
    });
    if (!stillActive()) return;
    if (!sdpResponse.ok) {
      setState('error');
      setHint(`WebRTC failed (${sdpResponse.status})`);
      stopSession();
      return;
    }
    const answerSdp = await sdpResponse.text();
    if (!stillActive()) return;
    try {
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    } catch {
      if (!stillActive()) return;
      setState('error');
      setHint('Samantha connection aborted');
      stopSession();
    }
  }

  function sendText(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open' || state !== 'listening') {
      pendingTextRef.current = text;
      setHint('Connecting… I’ll send that as soon as Samantha is ready');
      if (state === 'idle' || state === 'error') {
        void startSession();
      }
      return;
    }
    replyBufRef.current = '';
    setReply('');
    pendingTextRef.current = null;
    dc.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: buildOutboundUserText(text) }],
        },
      })
    );
    dc.send(JSON.stringify({ type: 'response.create' }));
    setDraft('');
    setHint('Samantha is thinking…');
  }

  function toggle() {
    if (open && (state === 'listening' || state === 'connecting')) {
      stopSession();
      setOpen(false);
      setHint('Samantha paused');
      setReply('');
      return;
    }
    if (open && state === 'idle') {
      setOpen(false);
      return;
    }
    setOpen(true);
    void startSession();
  }

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3"
      data-testid="samantha-orb-root"
    >
      {open ? (
        <div
          className="pointer-events-auto w-[340px] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-border/70 bg-card/95 px-4 py-3 text-sm shadow-[var(--surface-lift)] backdrop-blur-xl"
          data-testid="samantha-orb-panel"
        >
          <p className="text-base font-semibold tracking-tight text-foreground">Samantha</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
          {reply ? (
            <div
              className="mt-2 max-h-40 whitespace-pre-wrap overflow-y-auto border-t border-border/50 pt-2 text-xs leading-relaxed text-foreground"
              data-testid="samantha-orb-reply"
            >
              {replyForDisplay(reply)}
            </div>
          ) : null}
          <form className="mt-3 flex gap-2" onSubmit={sendText}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={state === 'connecting' ? 'Type while Samantha connects' : 'Ask Samantha'}
              data-testid="samantha-orb-text"
              className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-2 text-xs outline-none transition focus:ring-2 focus:ring-ring/40"
            />
            <button
              type="submit"
              data-testid="samantha-orb-send"
              disabled={!draft.trim()}
              className="rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition active:scale-[0.98] disabled:opacity-40"
            >
              Send
            </button>
          </form>
          <button
            type="button"
            className="mt-2 text-xs text-primary hover:underline"
            onClick={() => navigate('/config')}
          >
            Preferences and AgentGuard
          </button>
        </div>
      ) : null}
      <button
        type="button"
        aria-label={state === 'listening' ? 'Stop Samantha' : 'Open Samantha'}
        data-testid="samantha-orb"
        onClick={toggle}
        className={cn(
          'pointer-events-auto flex size-14 items-center justify-center rounded-full text-sm font-semibold transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          state === 'listening' &&
            'bg-primary text-primary-foreground shadow-[0_8px_24px_oklch(0.48_0.07_195_/_0.35)] ring-2 ring-primary/30',
          state === 'connecting' && 'bg-secondary text-foreground ring-2 ring-border',
          state === 'error' && 'bg-destructive/10 text-destructive ring-2 ring-destructive/30',
          state === 'idle' &&
            'bg-primary text-primary-foreground shadow-[0_8px_24px_oklch(0.48_0.07_195_/_0.28)] hover:scale-105 active:scale-[0.98]'
        )}
      >
        S
      </button>
    </div>
  );
}
