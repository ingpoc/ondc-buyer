import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth, useCart, useSubject } from '../hooks';
import { cn } from '../lib/utils';
import type {
  AgentGuardAction,
  AgentRef,
  IntentReceipt,
} from '@aadharchain/agentguard-contract';
import {
  compileBuyerMandate,
  confirmBuyerMandate,
  setBuyerAgentPaused,
  syncBuyerAgentGuardStatus,
  verifyBuyerReceipt,
} from '../lib/agentGuardCheckout';
import {
  buyerShoppingAgentLabel,
  getBuyerAgentAuthority,
  resetBuyerAgentAuthority,
  subscribeBuyerAgentAuthority,
} from '../lib/buyerAgentAuthority';
import {
  emptySamanthaMemory,
  loadSamanthaMemoryMerged,
  saveSamanthaMemory,
  type SamanthaMemory,
} from '../lib/samanthaMemory';
import { updateLocalBuyer, updateLocalDeliveryAddress } from '../lib/localCart';
import { buildCommerceUrl, COMMERCE_API_BASE, COMMERCE_DEMO_MODE } from '../lib/commerceConfig';
import { shouldUseLocalCartFallback } from '../lib/cartFailurePolicy';
import {
  loadSavedDeliveryArea,
  saveDeliveryAreaFromAddress,
} from '../lib/deliveryPreferences';

const BUYER_ACTIONS: { id: AgentGuardAction; label: string }[] = [
  { id: 'buyer.checkout.commit', label: 'Checkout' },
  { id: 'buyer.order.cancel', label: 'Cancel order' },
  { id: 'buyer.return.submit', label: 'Return' },
  { id: 'buyer.remedy.accept', label: 'Accept remedy' },
];

const PREF_TABS = [
  { id: 'profile', label: 'Profile details' },
  { id: 'agent-guard', label: 'Agent Guard' },
  { id: 'samantha', label: 'Samantha' },
  { id: 'activity', label: 'Activity' },
] as const;

type PrefTabId = (typeof PREF_TABS)[number]['id'];

export function coercePrefTab(raw: string | null): PrefTabId {
  const value = (raw || '').trim().toLowerCase().replace(/_/g, '-');
  if (value === 'profile' || value === 'details' || value === 'account') return 'profile';
  if (value === 'agent-guard' || value === 'agentguard' || value === 'mandate') return 'agent-guard';
  if (value === 'samantha' || value === 'memory') return 'samantha';
  if (value === 'activity' || value === 'receipts') return 'activity';
  return 'profile';
}

/**
 * Buyer preferences: vertical tabs for profile, AgentGuard, Samantha, activity.
 */
export function BuyerConfigPage() {
  const { walletAddress, subjectId } = useSubject();
  const { user } = useAuth();
  const { session, refreshCart } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = coercePrefTab(searchParams.get('tab'));

  const [checkoutAutoMax, setCheckoutAutoMax] = useState(10000);
  const [savedCheckoutAutoMax, setSavedCheckoutAutoMax] = useState<number | null>(null);
  const [selected, setSelected] = useState(BUYER_ACTIONS.map((a) => a.id));
  const [mandateStatus, setMandateStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [memory, setMemory] = useState<SamanthaMemory>(emptySamanthaMemory());
  const [agent, setAgent] = useState<AgentRef | null>(null);
  const [receipts, setReceipts] = useState<IntentReceipt[]>([]);
  const [receiptChecks, setReceiptChecks] = useState<Record<string, boolean>>({});

  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileTaxId, setProfileTaxId] = useState('');
  const [profileLine1, setProfileLine1] = useState('');
  const [profileCity, setProfileCity] = useState('');
  const [profileState, setProfileState] = useState('');
  const [profilePin, setProfilePin] = useState('');
  const [profileNote, setProfileNote] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const refresh = useCallback(async () => {
    setMemory(loadSamanthaMemoryMerged(subjectId));
    if (!subjectId) {
      resetBuyerAgentAuthority();
      setAgent(null);
      setReceipts([]);
      return;
    }
    try {
      const { snapshot } = await syncBuyerAgentGuardStatus(walletAddress);
      setAgent(snapshot.agent);
      setReceipts(snapshot.receipts);
      setMandateStatus(snapshot.mandateStatus);
      if (snapshot.checkoutAutoMax != null) {
        setCheckoutAutoMax(snapshot.checkoutAutoMax);
        setSavedCheckoutAutoMax(snapshot.checkoutAutoMax);
      }
    } catch {
      /* ignore */
    }
  }, [subjectId, walletAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return subscribeBuyerAgentAuthority(() => {
      const snapshot = getBuyerAgentAuthority();
      setAgent(snapshot.agent);
      setReceipts(snapshot.receipts);
      if (snapshot.mandateStatus) setMandateStatus(snapshot.mandateStatus);
    });
  }, []);

  useEffect(() => {
    const refreshMemory = () => setMemory(loadSamanthaMemoryMerged(subjectId));
    window.addEventListener('buyer-samantha-memory-changed', refreshMemory);
    return () => window.removeEventListener('buyer-samantha-memory-changed', refreshMemory);
  }, [subjectId]);

  useEffect(() => {
    const buyer = session?.buyer;
    const savedArea = loadSavedDeliveryArea(subjectId);
    if (!buyer && !savedArea) return;
    setProfileName(buyer?.name || '');
    setProfileEmail(buyer?.email || '');
    setProfilePhone(buyer?.phone || '');
    setProfileTaxId(buyer?.taxId || '');
    setProfileLine1(buyer?.street || '');
    setProfileCity(buyer?.city || savedArea?.city || '');
    setProfileState(buyer?.state || savedArea?.state || '');
    setProfilePin(buyer?.pincode || savedArea?.postalCode || '');
  }, [session, subjectId]);

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
      setSavedCheckoutAutoMax(checkoutAutoMax);
      setNote('Shopping limit saved.');
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
          ? 'Agent paused. Samantha cannot checkout; you can still checkout yourself.'
          : 'Agent resumed. Protected actions may run within the mandate.'
      );
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Agent control failed');
    } finally {
      setBusy(false);
    }
  }

  const shoppingLimitDirty =
    savedCheckoutAutoMax !== null && checkoutAutoMax !== savedCheckoutAutoMax;

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

  const profileDirty = useMemo(() => {
    const buyer = session?.buyer;
    const savedArea = loadSavedDeliveryArea(subjectId);
    const baselineCity = buyer?.city || savedArea?.city || '';
    const baselineState = buyer?.state || savedArea?.state || '';
    const baselinePin = buyer?.pincode || savedArea?.postalCode || '';
    if (!buyer && !savedArea) {
      return Boolean(
        profileName ||
          profileEmail ||
          profilePhone ||
          profileTaxId ||
          profileLine1 ||
          profileCity ||
          profileState ||
          profilePin
      );
    }
    return (
      profileName !== (buyer?.name || '') ||
      profileEmail !== (buyer?.email || '') ||
      profilePhone !== (buyer?.phone || '') ||
      profileTaxId !== (buyer?.taxId || '') ||
      profileLine1 !== (buyer?.street || '') ||
      profileCity !== baselineCity ||
      profileState !== baselineState ||
      profilePin !== baselinePin
    );
  }, [
    session,
    subjectId,
    profileName,
    profileEmail,
    profilePhone,
    profileTaxId,
    profileLine1,
    profileCity,
    profileState,
    profilePin,
  ]);

  async function saveProfile() {
    const sessionId = session?.id;
    if (!sessionId) {
      setProfileNote('No cart session yet — open Search or Cart first.');
      return;
    }
    if (!profileName.trim() || !profileEmail.trim() || !profilePhone.trim()) {
      setProfileNote('Name, email, and phone are required.');
      return;
    }
    setProfileSaving(true);
    setProfileNote(null);
    try {
      const billing = {
        name: profileName.trim(),
        email: profileEmail.trim(),
        phone: profilePhone.trim(),
        taxId: profileTaxId.trim().toUpperCase() || undefined,
      };
      if (shouldUseLocalCartFallback(COMMERCE_DEMO_MODE, COMMERCE_API_BASE)) {
        updateLocalBuyer(sessionId, billing);
      } else {
        const response = await fetch(buildCommerceUrl(`/api/cart/buyer/${sessionId}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(billing),
        });
        if (!response.ok) {
          throw new Error(`Could not save billing (HTTP ${response.status}).`);
        }
        // Keep local GSTIN + billing mirror for checkout forms even when API owns cart.
        updateLocalBuyer(sessionId, billing);
      }
      if (profileLine1.trim() || profileCity.trim() || profileState.trim() || profilePin.trim()) {
        if (!profileLine1.trim() || !profileCity.trim() || !profileState.trim() || !profilePin.trim()) {
          throw new Error('Delivery needs street, city, state, and PIN together.');
        }
        const address = {
          line1: profileLine1.trim(),
          city: profileCity.trim(),
          state: profileState.trim(),
          postalCode: profilePin.trim(),
          country: 'IND',
        };
        updateLocalDeliveryAddress(sessionId, address);
        saveDeliveryAreaFromAddress(subjectId, address);
      }
      await refreshCart();
      setProfileNote('Profile saved for checkout.');
    } catch (err) {
      setProfileNote(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setProfileSaving(false);
    }
  }

  const userChoseTab = useRef(false);

  function setTab(next: string) {
    const tab = coercePrefTab(next);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set('tab', tab);
        return params;
      },
      { replace: true }
    );
  }

  function handleTabChange(next: string) {
    if (!userChoseTab.current) return;
    const tab = coercePrefTab(next);
    if (tab === activeTab) return;
    setTab(tab);
  }

  const principalLabel =
    (typeof user?.display_name === 'string' && user.display_name) ||
    (typeof user?.email === 'string' && user.email) ||
    subjectId ||
    'Not signed in';

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4" data-testid="buyer-config-page">
      <div className="space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Preferences
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Buyer settings</h1>
        <p className="text-sm text-muted-foreground">
          Profile, AgentGuard limits, Samantha memory, and protected activity.
        </p>
      </div>

      {!subjectId ? (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Sign in to keep your shopping permissions and Samantha preferences with your account.
          </CardContent>
        </Card>
      ) : null}

      <Tabs
        orientation="vertical"
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full flex-col gap-4 sm:flex-row sm:items-start sm:gap-6"
        data-testid="buyer-config-tabs"
      >
        <TabsList
          className="h-auto w-full shrink-0 flex-row flex-wrap justify-start gap-1 rounded-2xl bg-transparent p-0 sm:w-48 sm:flex-col sm:flex-nowrap sm:items-stretch sm:border-r sm:border-border sm:pr-3"
          aria-label="Preference sections"
          onPointerDown={() => {
            userChoseTab.current = true;
          }}
          onKeyDown={() => {
            userChoseTab.current = true;
          }}
        >
          {PREF_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                data-active={isActive ? 'true' : undefined}
                onPointerDown={() => {
                  userChoseTab.current = true;
                }}
                className={cn(
                  'justify-start rounded-lg px-3 py-2 text-left text-muted-foreground after:hidden hover:bg-primary/5 hover:text-primary',
                  isActive &&
                    '!bg-primary/12 !font-semibold !text-primary shadow-none hover:!bg-primary/12 hover:!text-primary dark:!bg-primary/20'
                )}
                data-testid={`buyer-config-tab-${tab.id}`}
              >
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="min-w-0 flex-1">
          <TabsContent value="profile" className="mt-0 outline-none" data-testid="buyer-config-profile">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Profile details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-1 rounded-lg border border-border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Account
                  </p>
                  <p className="font-medium">{principalLabel}</p>
                  {subjectId ? <p className="text-xs text-muted-foreground">Signed-in account</p> : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1 sm:col-span-2">
                    <span className="text-muted-foreground">Full name</span>
                    <Input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      autoComplete="name"
                      data-testid="buyer-config-profile-name"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-muted-foreground">Email</span>
                    <Input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      autoComplete="email"
                      data-testid="buyer-config-profile-email"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-muted-foreground">Phone *</span>
                    <Input
                      type="tel"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      autoComplete="tel"
                      data-testid="buyer-config-profile-phone"
                    />
                  </label>
                  <label className="block space-y-1 sm:col-span-2">
                    <span className="text-muted-foreground">GSTIN (optional)</span>
                    <Input
                      value={profileTaxId}
                      onChange={(e) => setProfileTaxId(e.target.value.toUpperCase())}
                      placeholder="29ABCDE1234F1Z5"
                      maxLength={15}
                      data-testid="buyer-config-profile-gstin"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      Used for business purchases and GST invoices at checkout.
                    </span>
                  </label>
                  <label className="block space-y-1 sm:col-span-2">
                    <span className="text-muted-foreground">Street address *</span>
                    <Input
                      value={profileLine1}
                      onChange={(e) => setProfileLine1(e.target.value)}
                      autoComplete="street-address"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-muted-foreground">City</span>
                    <Input
                      value={profileCity}
                      onChange={(e) => setProfileCity(e.target.value)}
                      autoComplete="address-level2"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-muted-foreground">State</span>
                    <Input
                      value={profileState}
                      onChange={(e) => setProfileState(e.target.value)}
                      autoComplete="address-level1"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-muted-foreground">PIN</span>
                    <Input
                      value={profilePin}
                      onChange={(e) => setProfilePin(e.target.value)}
                      autoComplete="postal-code"
                      inputMode="numeric"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={profileSaving || !profileDirty}
                    onClick={() => void saveProfile()}
                    data-testid="buyer-config-profile-save"
                  >
                    {profileSaving ? 'Saving…' : 'Save profile'}
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/checkout">Open checkout</Link>
                  </Button>
                  {profileDirty ? <Badge variant="outline">Unsaved changes</Badge> : null}
                </div>
                {profileNote ? <p className="text-xs text-muted-foreground">{profileNote}</p> : null}
                <p className="text-[11px] text-muted-foreground">
                  These fields prefill checkout for this browser session. Samantha can also fill them
                  when you dictate details in chat.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="agent-guard"
            className="mt-0 outline-none"
            data-testid="buyer-config-agentguard"
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Shopping agent permissions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <label className="block space-y-1">
                  <span className="text-muted-foreground">Auto-approve checkout up to (INR)</span>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={checkoutAutoMax}
                    onChange={(e) => setCheckoutAutoMax(Number(e.target.value) || 0)}
                    data-testid="buyer-config-checkout-max"
                  />
                  <span className="text-xs text-muted-foreground">
                    Enter any whole-rupee limit from INR 0 upward.
                  </span>
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
                              prev.includes(a.id)
                                ? prev.filter((x) => x !== a.id)
                                : [...prev, a.id]
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
                    disabled={
                      !subjectId ||
                      busy ||
                      selected.length === 0 ||
                      (mandateStatus === 'active' &&
                        savedCheckoutAutoMax !== null &&
                        !shoppingLimitDirty)
                    }
                    onClick={() => void confirmMandate()}
                    data-testid="buyer-config-confirm-mandate"
                  >
                    {mandateStatus === 'active' && !shoppingLimitDirty
                      ? 'Shopping limit saved'
                      : 'Save shopping limit'}
                  </Button>
                  <Badge variant="outline">
                    {shoppingLimitDirty
                      ? 'Unsaved changes'
                      : mandateStatus === 'active'
                        ? 'Limit on'
                        : 'No limit yet'}
                  </Badge>
                  <Badge variant={agent?.status === 'active' ? 'default' : 'outline'}>
                    {buyerShoppingAgentLabel(agent?.status, 'preferences')}
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!agent || busy || agent.status === 'revoked'}
                    onClick={() => void toggleAgent()}
                    data-testid="buyer-config-toggle-agent"
                  >
                    {agent?.status === 'paused' ? 'Resume shopping agent' : 'Pause shopping agent'}
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/checkout">Checkout</Link>
                  </Button>
                </div>
                {note ? (
                  <p className="text-xs text-muted-foreground" data-testid="buyer-config-agent-note">
                    {note}
                  </p>
                ) : null}
                <p className="text-[11px] text-muted-foreground">
                  Limits and activity are saved for this signed-in account on this demo host. They may
                  reset if the demo environment restarts.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="samantha"
            className="mt-0 outline-none"
            data-testid="buyer-config-samantha"
          >
            <Card>
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
          </TabsContent>

          <TabsContent
            value="activity"
            className="mt-0 outline-none"
            data-testid="buyer-config-activity"
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Intent Receipts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {note && activeTab === 'activity' ? (
                  <p className="text-xs text-muted-foreground">{note}</p>
                ) : null}
                {receipts.length === 0 ? (
                  <p className="text-muted-foreground">
                    No protected actions recorded for this account.
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
                              INR {receipt.amount_inr} ·{' '}
                              {new Date(receipt.created_at).toLocaleString()}
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
                              data-testid={`buyer-verify-receipt-${receipt.receipt_id}`}
                            >
                              Verify Intent Receipt
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
