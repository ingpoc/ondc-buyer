import { beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogSearchQuery, coerceBuyerNavPath, resolveBuyerCartItem, runBuyerTool } from './agentTools';
import { clearBuyerCatalogCache } from './buyerCatalogCache';
import { searchCommerceItems, getCommerceItem } from './commerceClient';

vi.mock('./commerceClient', () => ({
  searchCommerceItems: vi.fn(async () => ({ items: [], totalCount: 0, __source: 'api' })),
  getCommerceItem: vi.fn(async (itemId: string) => {
    throw new Error(`Unknown item: ${itemId}`);
  }),
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
  executeBuyerCheckout: vi.fn(),
}));

vi.mock('./samanthaMemory', () => ({
  rememberSamanthaFact: vi.fn(),
}));

describe('buyer agent tools cart path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    clearBuyerCatalogCache();
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

  it('set_cart_quantity uses the only cart line when the user says make it two', async () => {
    const result = await runBuyerTool(
      'set_cart_quantity',
      { quantity: 2 },
      {
        subjectId: 'principal:demo:test',
        cartItems: [{ itemId: 'atta-1', name: 'Whole Wheat Atta', quantity: 1 }],
      },
    );
    expect(result.cartChanges).toEqual([
      { action: 'set_quantity', itemId: 'atta-1', quantity: 2 },
    ]);
  });
});
