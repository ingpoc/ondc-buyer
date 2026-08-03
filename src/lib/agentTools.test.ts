import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUYER_TOOL_DEFINITIONS,
  buildPersonalizedBuyerSearchPath,
  catalogSearchQuery,
  inferBuyerSearchCategory,
  localSearchPreferenceFacts,
  resolveCustomerSearchQuery,
  coerceBuyerNavPath,
  resolveBuyerCartItem,
  runBuyerTool,
} from './agentTools';
import { clearBuyerCatalogCache } from './buyerCatalogCache';
import {
  searchCommerceItems,
  getCommerceItem,
  getCommerceOrder,
  listCommerceBuyerOrders,
} from './commerceClient';
import { evaluateBuyerCheckout, executeBuyerCheckout } from './agentGuardCheckout';
import { prepareDurableCheckout } from './commerceV1Client';

vi.mock('./commerceClient', () => ({
  searchCommerceItems: vi.fn(async () => ({ items: [], totalCount: 0, __source: 'api' })),
  getCommerceItem: vi.fn(async (itemId: string) => {
    throw new Error(`Unknown item: ${itemId}`);
  }),
  getCommerceOrder: vi.fn(),
  listCommerceBuyerOrders: vi.fn(async () => []),
  orderFromCommerceExecution: vi.fn(() => null),
}));

vi.mock('./ondc/protocolClient', () => ({
  isOndcNetworkSearchReady: vi.fn(async () => false),
  dispatchBuyerSearch: vi.fn(),
  ondcSearch: vi.fn(),
  ondcSearchAndCollect: vi.fn(),
  wakeGateway: vi.fn(async () => true),
  OUR_BPP_ID: 'ondcseller.aadharcha.in',
}));

vi.mock('./agentGuardCheckout', () => ({
  evaluateBuyerCheckout: vi.fn(),
  executeBuyerCheckout: vi.fn(),
}));

vi.mock('./commerceV1Client', () => ({
  prepareDurableCheckout: vi.fn(),
}));

vi.mock('./samanthaMemory', () => ({
  loadSamanthaMemory: vi.fn(() => ({
    likes: [], dislikes: [], preferences: [], notes: [], updatedAt: '2026-07-17T00:00:00Z',
  })),
  relevantSearchPreferences: vi.fn(() => ({
    preferenceTerms: [], appliedLabels: [],
  })),
  rememberSamanthaFact: vi.fn(),
}));

describe('buyer agent tools cart path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    clearBuyerCatalogCache();
    localStorage.clear();
  });

  it('returns empty demo-commerce results without mock fallback', async () => {
    const result = await runBuyerTool(
      'search_catalog',
      { query: 'apple' },
      { walletAddress: 'wallet-demo' },
    );
    expect(result.ok).toBe(true);
    expect(result.data?.source).toBe('demo-commerce');
    expect(result.data?.count).toBe(0);
    expect(result.navigateTo).toBe('/results?category=grocery&q=apple');
  });

  it('places only derived relevant preferences in Samantha results URLs', async () => {
    const { relevantSearchPreferences } = await import('./samanthaMemory');
    vi.mocked(relevantSearchPreferences).mockReturnValueOnce({
      maxPrice: 200,
      deliveryArea: 'Pune',
      preferenceTerms: ['unpolished'],
      appliedLabels: ['Under INR 200', 'Deliver to Pune', 'Prefer unpolished'],
    });

    const built = buildPersonalizedBuyerSearchPath('Find toor dal', 'principal:buyer:a');
    expect(built.path).toContain('q=toor+dal');
    expect(built.path).toContain('max_price=200');
    expect(built.path).toContain('delivery_area=Pune');
    expect(built.path).toContain('preference=unpolished');
  });

  it('search_catalog uses demo-commerce hits when present', async () => {
    vi.mocked(searchCommerceItems).mockResolvedValueOnce({
      items: [
        {
          id: 'sku-banana',
          name: 'Robusta Bananas',
          price: { currency: 'INR', value: '40' },
        },
      ],
      totalCount: 1,
      __source: 'api',
    } as never);
    const result = await runBuyerTool(
      'search_catalog',
      { query: 'banana' },
      { subjectId: 'principal:demo:test' },
    );
    expect(result.ok).toBe(true);
    expect(result.data?.source).toBe('demo-commerce');
    expect(result.navigateTo).toMatch(/\/results\?category=grocery&q=banana/);
    const items = result.data?.items as Array<{ id: string; name: string }>;
    expect(items.some((item) => /banana/i.test(item.name))).toBe(true);
  });

  it('catalogSearchQuery strips NL filler for demo-commerce lookup', () => {
    expect(catalogSearchQuery('Find atta under 200 rupees and add one to cart')).toBe('atta');
    expect(catalogSearchQuery('AgentGuard PreProd Atta')).toBe('atta');
    expect(catalogSearchQuery('whole wheat atta price under INR 100')).toBe('atta');
    expect(catalogSearchQuery('organic toned milk')).toBe('milk');
    expect(catalogSearchQuery('Search for toor dal')).toBe('toor dal');
    expect(catalogSearchQuery('I need whole wheat atta for roti tonight')).toBe('atta');
    expect(catalogSearchQuery('get me atta for roti tonight')).toBe('atta');
    expect(catalogSearchQuery('whole-wheat atta or flour options tonight')).toBe('atta');
    expect(catalogSearchQuery('Search for a TV')).toBe('tv');
    expect(catalogSearchQuery('find television under 15000')).toBe('tv');
    expect(catalogSearchQuery('show cooking oil')).toBe('oil');
    expect(catalogSearchQuery('basmati rice')).toBe('basmati rice');
    expect(catalogSearchQuery("I'm looking for Atta, actually.")).toBe('atta');
    expect(catalogSearchQuery('Can you again show me somebody?')).not.toBe('somebody');
    expect(inferBuyerSearchCategory('Search for a TV')).toBe('electronics');
    expect(inferBuyerSearchCategory('show cooking oil')).toBe('grocery');
    expect(buildPersonalizedBuyerSearchPath('Search for a TV').path).toContain(
      'category=electronics',
    );
    expect(buildPersonalizedBuyerSearchPath('Search for a TV').path).toContain('q=tv');
  });

  it('keeps the current customer product request when the tool emits only a preference', () => {
    expect(resolveCustomerSearchQuery('unpolished', 'Search for toor dal')).toBe(
      'Search for toor dal',
    );
    expect(catalogSearchQuery(resolveCustomerSearchQuery('unpolished', 'Search for toor dal'))).toBe(
      'toor dal',
    );
  });

  it('does not treat a memory-only turn as the current product query', () => {
    expect(resolveCustomerSearchQuery('toor dal', 'Remember that I like unpolished groceries')).toBe(
      'toor dal',
    );
  });

  it('derives only explicit safe preference facts for local text fallback', () => {
    expect(
      localSearchPreferenceFacts(
        'I prefer unpolished groceries and Pune delivery. Search for toor dal.',
      ),
    ).toEqual(['Prefer unpolished groceries', 'Deliver to Pune']);
    expect(localSearchPreferenceFacts('Search for toor dal; I also like jazz')).toEqual([]);
  });

  it('search_catalog passes keyword not full NL sentence to demo-commerce', async () => {
    vi.mocked(searchCommerceItems).mockResolvedValueOnce({
      items: [
        {
          id: 'sku-atta',
          name: 'Whole Wheat Atta 1kg',
          price: { currency: 'INR', value: '89' },
        },
      ],
      totalCount: 1,
      __source: 'api',
    } as never);
    const result = await runBuyerTool(
      'search_catalog',
      { query: 'Find atta under 200 rupees and add one to cart' },
      { subjectId: 'principal:demo:test' },
    );
    expect(searchCommerceItems).toHaveBeenCalledWith('atta');
    expect(result.navigateTo).toMatch(/q=atta/);
    expect(result.data?.count).toBe(1);
  });

  it('uses ONDC network dispatch-only when adapter ready (no collect poll)', async () => {
    const { isOndcNetworkSearchReady, dispatchBuyerSearch, ondcSearchAndCollect } = await import(
      './ondc/protocolClient'
    );
    vi.mocked(isOndcNetworkSearchReady).mockResolvedValueOnce(true);
    vi.mocked(dispatchBuyerSearch).mockResolvedValueOnce({
      transaction_id: 'txn-1',
      message_id: 'm-1',
      ack: 'ACK',
    });
    const result = await runBuyerTool(
      'search_catalog',
      { query: 'banana' },
      { subjectId: 'principal:demo:test' },
    );
    expect(result.ok).toBe(true);
    expect(result.data?.source).toBe('ondc-network');
    expect(result.data?.transaction_id).toBe('txn-1');
    expect(result.data?.loading).toBe(true);
    expect(result.navigateTo).toContain('ondc_txn=txn-1');
    expect(ondcSearchAndCollect).not.toHaveBeenCalled();
  });

  it('add_to_cart resolves network item ids from search cache', async () => {
    const { rememberOndcCatalogItems } = await import('./buyerCatalogCache');
    rememberOndcCatalogItems([
      { id: 'net-banana-9', name: 'Network Banana', price_inr: '42', bpp_id: 'bpp.example' },
    ]);
    const added = await runBuyerTool(
      'add_to_cart',
      { item_id: 'net-banana-9', quantity: 2 },
      { subjectId: 'principal:demo:test' },
    );
    expect(added.ok).toBe(true);
    expect(added.navigateTo).toBe('/cart');
    expect(added.cartAdds?.[0]?.itemId).toBe('net-banana-9');
    expect(added.cartAdds?.[0]?.item.name).toMatch(/Banana/i);
  });

  it('add_to_cart resolves by product name from results cache', async () => {
    const { clearBuyerCatalogCache, rememberOndcCatalogItems } = await import(
      './buyerCatalogCache'
    );
    clearBuyerCatalogCache();
    rememberOndcCatalogItems([
      {
        id: 'item_atta_preprod',
        name: 'AgentGuard PreProd Atta 1kg',
        price_inr: '89',
        bpp_id: 'ondcseller.aadharcha.in',
      },
    ]);
    const added = await runBuyerTool(
      'add_to_cart',
      { query: 'atta' },
      { subjectId: 'principal:demo:test' },
    );
    expect(added.ok).toBe(true);
    expect(added.cartAdds?.[0]?.itemId).toBe('item_atta_preprod');
    expect(added.navigateTo).toBe('/cart');
  });

  it('rejects unknown item ids instead of silently queuing', async () => {
    const { clearBuyerCatalogCache } = await import('./buyerCatalogCache');
    clearBuyerCatalogCache();
    const result = await runBuyerTool(
      'add_to_cart',
      { item_id: 'item_does_not_exist' },
      { walletAddress: 'wallet-demo' },
    );
    expect(result.ok).toBe(false);
    expect(result.cartAdds).toBeUndefined();
    expect(result.message).toMatch(/No cached result|Nothing in the results cache/i);
  });

  it('resolveBuyerCartItem does not invent mock catalog ids', async () => {
    const item = await resolveBuyerCartItem('organic-apples-1kg');
    expect(item).toBeNull();
  });

  it('resolveBuyerCartItem returns commerce item when API resolves', async () => {
    vi.mocked(getCommerceItem).mockResolvedValueOnce({
      id: 'sku-1',
      name: 'Atta',
      price: { currency: 'INR', value: '50' },
    } as never);
    const item = await resolveBuyerCartItem('sku-1');
    expect(item?.id).toBe('sku-1');
  });

  it('coerceBuyerNavPath normalizes cart tool args', () => {
    expect(coerceBuyerNavPath('cart')).toBe('/cart');
    expect(coerceBuyerNavPath('/cart')).toBe('/cart');
    expect(coerceBuyerNavPath('config')).toBe('/config');
    expect(coerceBuyerNavPath('agent')).toBeNull();
    expect(coerceBuyerNavPath('/agent')).toBeNull();
  });

  it('keeps page navigation distinct from product catalog search', () => {
    const search = BUYER_TOOL_DEFINITIONS.find((tool) => tool.name === 'search_catalog');
    const navigate = BUYER_TOOL_DEFINITIONS.find((tool) => tool.name === 'navigate_to');

    expect(search?.description).toMatch(/Cart.*app pages, not products/i);
    expect(navigate?.description).toMatch(/show me my cart/i);
  });

  it('clear_cart returns an explicit host mutation for every live cart line', async () => {
    const result = await runBuyerTool(
      'clear_cart',
      {},
      {
        subjectId: 'principal:demo:test',
        cartItems: [
          { itemId: 'atta-1', name: 'Whole Wheat Atta', quantity: 1 },
          { itemId: 'milk-1', name: 'Toned Milk', quantity: 2 },
        ],
      },
    );
    expect(result.ok).toBe(true);
    expect(result.cartChanges).toEqual([{ action: 'clear' }]);
    expect(result.navigateTo).toBe('/cart');
  });

  it('track_order returns persisted vendor and history for the newest Buyer order', async () => {
    vi.mocked(listCommerceBuyerOrders).mockResolvedValueOnce([
      {
        id: 'order-older',
        status: 'created',
        createdAt: '2026-07-23T00:00:00Z',
        items: [],
      },
      {
        id: 'order-latest',
        status: 'shipped',
        createdAt: '2026-07-23T01:00:00Z',
        updatedAt: '2026-07-23T02:00:00Z',
        items: [],
        fulfillment: {
          type: 'delivery',
          status: 'in_transit',
          providerName: 'Lifecycle Logistics',
          tracking: {
            id: 'TRACK-1',
            url: 'https://logistics.example/track/TRACK-1',
            status: 'shipped',
            statusMessage: 'Collected from seller',
          },
          history: [
            {
              status: 'shipped',
              recordedAt: '2026-07-23T02:00:00Z',
              trackingId: 'TRACK-1',
              statusMessage: 'Collected from seller',
            },
          ],
        },
      },
    ]);

    const result = await runBuyerTool('track_order', {}, { subjectId: 'principal:demo:test' });

    expect(getCommerceOrder).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      navigateTo: '/orders/order-latest',
      data: {
        order_id: 'order-latest',
        provider_name: 'Lifecycle Logistics',
        tracking_id: 'TRACK-1',
        tracking_url: 'https://logistics.example/track/TRACK-1',
        history: [{ status: 'shipped', trackingId: 'TRACK-1' }],
      },
    });
    expect(result.message).toContain('Verified tracking: https://logistics.example/track/TRACK-1.');
  });

  it('track_order reads a requested order without inventing missing logistics data', async () => {
    vi.mocked(getCommerceOrder).mockResolvedValueOnce({
      id: 'order-created',
      status: 'created',
      createdAt: '2026-07-23T00:00:00Z',
      items: [],
      fulfillment: {
        type: 'delivery',
        status: 'pending',
        tracking: { status: 'created', statusMessage: 'Awaiting seller confirmation.' },
      },
    });

    const result = await runBuyerTool(
      'track_order',
      { order_id: 'order-created' },
      { subjectId: 'principal:demo:test' },
    );

    expect(getCommerceOrder).toHaveBeenCalledWith('order-created');
    expect(result.data).toMatchObject({
      order_id: 'order-created',
      provider_name: undefined,
      tracking_id: undefined,
    });
    expect(result.message).not.toMatch(/provider|tracking ID/i);
  });

  it('remove_from_cart resolves a first-time user product phrase from live cart context', async () => {
    const result = await runBuyerTool(
      'remove_from_cart',
      { query: 'atta' },
      {
        subjectId: 'principal:demo:test',
        cartItems: [{ itemId: 'atta-1', name: 'Whole Wheat Atta', quantity: 1 }],
      },
    );
    expect(result.cartChanges).toEqual([{ action: 'remove', itemId: 'atta-1' }]);
  });

  it('fill_checkout writes billing + delivery and opens checkout without committing', async () => {
    const sessionId = 'session-fill-1';
    localStorage.setItem('ondc-session-id', sessionId);
    const { addLocalItem, getLocalSession } = await import('./localCart');
    const { getMockBuyerItems } = await import('./mockSearch');
    const item = getMockBuyerItems()[0];
    expect(item).toBeTruthy();
    addLocalItem(sessionId, item as never, 1);

    const result = await runBuyerTool(
      'fill_checkout',
      {
        session_id: sessionId,
        name: 'Gurusharan Gupta',
        email: 'buyer@example.com',
        phone: '+919876543210',
        line1: '42 Market Road',
        city: 'Pune',
        state: 'Maharashtra',
        postal_code: '411001',
      },
      { subjectId: 'principal:demo:test' },
    );
    expect(result.ok).toBe(true);
    expect(result.navigateTo).toBe('/checkout');
    expect(result.message).not.toMatch(/commit|receipt/i);
    const buyer = getLocalSession(sessionId).buyer;
    expect(buyer?.name).toBe('Gurusharan Gupta');
    expect(buyer?.email).toBe('buyer@example.com');
    expect(buyer?.phone).toBe('+919876543210');
    expect(buyer?.street).toBe('42 Market Road');
    expect(buyer?.city).toBe('Pune');
    expect(buyer?.pincode).toBe('411001');
  });

  it('checkout_commit prepares an exact durable quote before AgentGuard review', async () => {
    const sessionId = 'session-checkout-address';
    localStorage.setItem('ondc-session-id', sessionId);
    const { addLocalItem } = await import('./localCart');
    const { getMockBuyerItems } = await import('./mockSearch');
    addLocalItem(sessionId, getMockBuyerItems()[0] as never, 1);
    await runBuyerTool(
      'fill_checkout',
      {
        session_id: sessionId,
        name: 'Gurusharan Gupta',
        email: 'buyer@example.com',
        phone: '+919876543210',
        line1: '42 Market Road',
        city: 'Pune',
        state: 'Maharashtra',
        postal_code: '411001',
      },
      { subjectId: 'principal:demo:test' },
    );
    vi.mocked(prepareDurableCheckout).mockResolvedValueOnce({
      cart: { cart_id: 'cart-1', seller_id: 'seller-1', version: 2 },
      quote: {
        quote_id: 'quote-1',
        cart_id: 'cart-1',
        cart_version: 2,
        subtotal_paise: 9900,
        landed_total_paise: 9900,
        expires_at: '2026-07-22T12:00:00Z',
      },
      correlationId: 'buyer-checkout:attempt-1',
    });
    vi.mocked(evaluateBuyerCheckout).mockResolvedValueOnce({
      decision: 'need_approval',
      decision_id: 'decision-1',
      reason: 'Exact approval required',
      approval: { approval_id: 'approval-1' },
      receipt: null,
    } as never);

    const result = await runBuyerTool(
      'checkout_commit',
      { session_id: sessionId, amount_inr: 99 },
      { subjectId: 'principal:demo:test' },
    );

    expect(result.ok).toBe(true);
    expect(prepareDurableCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.any(Array),
      }),
    );
    expect(evaluateBuyerCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteId: 'quote-1',
        amountInr: 99,
        correlationId: 'buyer-checkout:attempt-1',
      }),
    );
    expect(executeBuyerCheckout).not.toHaveBeenCalled();
  });

  it('checkout_commit opens checkout instead of creating an address-less order', async () => {
    const sessionId = 'session-checkout-missing-address';
    const { getLocalSession } = await import('./localCart');
    getLocalSession(sessionId);

    const result = await runBuyerTool(
      'checkout_commit',
      { session_id: sessionId, amount_inr: 99 },
      { subjectId: 'principal:demo:test' },
    );

    expect(result.ok).toBe(false);
    expect(result.navigateTo).toBe('/checkout');
    expect(result.message).toMatch(/street.*6-digit PIN/i);
    expect(executeBuyerCheckout).not.toHaveBeenCalled();
  });
});
