import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { useSubject } from '../hooks';
import {
  compileBuyerMandate,
  confirmBuyerMandate,
  fetchBuyerAgentGuardStatus,
  setBuyerAgentPaused,
  verifyBuyerReceipt,
  type BuyerAgentGuardAgent,
  type BuyerAgentGuardReceipt,
} from '../lib/agentGuardCheckout';
import {
  emptySamanthaMemory,
  loadSamanthaMemoryMerged,
  saveSamanthaMemory,
  type SamanthaMemory,
} from '../lib/samanthaMemory';

const BUYER_ACTIONS = [
  { id: 'buyer.checkout.commit', label: 'Checkout' },
  { id: 'buyer.order.cancel', label: 'Cancel order' },
  { id: 'buyer.return.submit', label: 'Return' },
  { id: 'buyer.remedy.accept', label: 'Accept remedy' },
];

/**
 * Compact Buyer config: AgentGuard mandate + Samantha memory.
 */
export function BuyerConfigPage() {
  const { walletAddress, subjectId } = useSubject();
  const [checkoutAutoMax, setCheckoutAutoMax] = useState(10000);
  const [selected, setSelected] = useState(BUYER_ACTIONS.map((a) => a.id));
  const [mandateStatus, setMandateStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [memory, setMemory] = useState<SamanthaMemory>(emptySamanthaMemory());
  const [agent, setAgent] = useState<BuyerAgentGuardAgent | null>(null);
  const [receipts, setReceipts] = useState<BuyerAgentGuardReceipt[]>([]);
  const [receiptChecks, setReceiptChecks] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    setMemory(loadSamanthaMemoryMerged(subjectId));
    if (!subjectId) {
      setAgent(null);
      setReceipts([]);
      return;
    }
    try {
      const status = await fetchBuyerAgentGuardStatus(walletAddress);
      setAgent(status.agent);
      setReceipts(status.receipts);
      setMandateStatus(status.mandate?.status ?? null);
      const auto = status.mandate?.limits?.auto_approve_max_inr as
        | Record<string, number>
        | undefined;
      if (auto?.['buyer.checkout.commit'] != null) {
        setCheckoutAutoMax(Number(auto['buyer.checkout.commit']));
      }
    } catch {
      /* ignore */
    }
  }, [subjectId, walletAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function confirmMandate() {
    if (!subjectId) return;
    setBusy(true);
    setNote(null);
    try {
      const compiled = await compileBuyerMandate({
        walletAddress,
        checkoutAutoMaxInr: checkoutAutoMax,
        allowedActions: selected,
      });
      const confirmed = await confirmBuyerMandate({
        walletAddress,
        mandateId: compiled.mandate.mandate_id,
      });
      setMandateStatus(confirmed.mandate.status ?? 'active');
      setNote('Mandate confirmed.');
      await refresh();
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Confirm failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleAgent() {
    if (!agent) return;
    const shouldPause = agent.status === 'active';
    setBusy(true);
    setNote(null);
    try {
      const result = await setBuyerAgentPaused({
        agentId: agent.agent_id,
        paused: shouldPause,
      });
      setAgent(result.agent);
      setNote(
        shouldPause
          ? 'Agent paused. The next protected action will be blocked.'
          : 'Agent resumed. Protected actions may run within the mandate.'
      );
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Agent control failed');
    } finally {
      setBusy(false);
    }
  }

  async function verifyReceipt(receiptId: string) {
    setBusy(true);
    setNote(null);
    try {
      const result = await verifyBuyerReceipt({ receiptId });
      setReceiptChecks((current) => ({ ...current, [receiptId]: result.valid }));
      if (!result.valid) setNote(result.reason || 'Receipt verification failed.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Receipt verification failed');
    } finally {
      setBusy(false);
    }
  }

  function clearMemory() {
    const empty = emptySamanthaMemory();
    setMemory(saveSamanthaMemory(subjectId, empty));
  }

  function removeFact(
    kind: keyof Pick<SamanthaMemory, 'likes' | 'dislikes' | 'preferences' | 'notes'>,
    value: string
  ) {
    const next = { ...memory, [kind]: memory[kind].filter((x) => x !== value) };
    setMemory(saveSamanthaMemory(subjectId, next));
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4" data-testid="buyer-config-page">
      <div className="space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Config
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">AgentGuard & Samantha</h1>
        <p className="text-sm text-muted-foreground">
          Authorize what the shopping agent may do. Samantha remembers compact likes and preferences
          while you talk.
        </p>
      </div>

      {!subjectId ? (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Sign in to bind AgentGuard and Samantha memory to your principal.
          </CardContent>
        </Card>
      ) : null}

      <Card data-testid="buyer-config-agentguard">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">AgentGuard mandate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <label className="block space-y-1">
            <span className="text-muted-foreground">Auto-approve checkout up to (INR)</span>
            <Input
              type="number"
              min={0}
              step={100}
              value={checkoutAutoMax}
              onChange={(e) => setCheckoutAutoMax(Number(e.target.value) || 0)}
              data-testid="buyer-config-checkout-max"
            />
          </label>
          <fieldset className="space-y-1">
            <legend className="text-muted-foreground">Allowed actions</legend>
            <div className="grid grid-cols-2 gap-2">
              {BUYER_ACTIONS.map((a) => (
                <label key={a.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(a.id)}
                    onChange={() =>
                      setSelected((prev) =>
                        prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                      )
                    }
                  />
                  {a.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!subjectId || busy || selected.length === 0}
              onClick={() => void confirmMandate()}
              data-testid="buyer-config-confirm-mandate"
            >
              Confirm mandate
            </Button>
            <Badge variant="outline">{mandateStatus ?? 'not confirmed'}</Badge>
            <Badge variant={agent?.status === 'active' ? 'default' : 'outline'}>
              Agent {agent?.status ?? 'unavailable'}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!agent || busy || agent.status === 'revoked'}
              onClick={() => void toggleAgent()}
              data-testid="buyer-config-toggle-agent"
            >
              {agent?.status === 'paused' ? 'Resume agent' : 'Pause agent'}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/checkout">Checkout</Link>
            </Button>
          </div>
          {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
          <p className="text-[11px] text-muted-foreground">
            Demo activity survives within the current free-hosting instance, but may reset after a
            restart or redeploy. Durable production storage is not enabled.
          </p>
        </CardContent>
      </Card>

      <Card data-testid="buyer-config-activity">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Protected activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {receipts.length === 0 ? (
            <p className="text-muted-foreground">
              No protected actions recorded for this principal.
            </p>
          ) : (
            <ul className="space-y-2">
              {receipts.map((receipt) => (
                <li key={receipt.receipt_id} className="rounded-md border border-border p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {receipt.action.replace('buyer.', '').replaceAll('.', ' ')} ·{' '}
                        {receipt.outcome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        INR {receipt.amount_inr} · {new Date(receipt.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {receiptChecks[receipt.receipt_id] === true ? (
                        <Badge variant="outline">Verified</Badge>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void verifyReceipt(receipt.receipt_id)}
                      >
                        Verify receipt
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card data-testid="buyer-config-samantha">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Samantha memory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(
            [
              ['likes', 'Likes'],
              ['dislikes', 'Dislikes'],
              ['preferences', 'Preferences'],
              ['notes', 'Notes'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <p className="mb-1 text-muted-foreground">{label}</p>
              {memory[key].length === 0 ? (
                <p className="text-xs text-muted-foreground">—</p>
              ) : (
                <ul className="flex flex-wrap gap-1">
                  {memory[key].map((item) => (
                    <li key={item}>
                      <button
                        type="button"
                        className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-muted"
                        title="Remove"
                        onClick={() => removeFact(key, item)}
                      >
                        {item} ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={clearMemory}>
              Clear memory
            </Button>
            <p className="self-center text-[11px] text-muted-foreground">
              Updated {new Date(memory.updatedAt).toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
