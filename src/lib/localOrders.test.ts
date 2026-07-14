import { beforeEach, describe, expect, it } from 'vitest';
import type { UCPOrder } from '../types';
import { getDemoOrder, listDemoOrders, upsertDemoOrder } from './localOrders';

const order = {
  id: 'order-a',
  status: 'created',
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z',
  items: [],
} as UCPOrder;

describe('local buyer order isolation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('never exposes one principal orders to another principal or a guest', () => {
    upsertDemoOrder(order, 'principal:auth0:a');

    expect(listDemoOrders('principal:auth0:a')).toHaveLength(1);
    expect(listDemoOrders('principal:auth0:b')).toEqual([]);
    expect(listDemoOrders(null)).toEqual([]);
    expect(getDemoOrder(order.id, 'principal:auth0:b')).toBeNull();
  });

  it('ignores the legacy unscoped order key', () => {
    localStorage.setItem('ondc-local-demo-orders', JSON.stringify([order]));
    expect(listDemoOrders('principal:auth0:a')).toEqual([]);
    expect(listDemoOrders(null)).toEqual([]);
  });
});
