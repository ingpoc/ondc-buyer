import { describe, expect, it } from 'vitest';
import type { UCPItem } from '../types';
import {
  filterBuyerItemsForCategory,
  filterBuyerItemsForQuery,
  filterBuyerSearchResults,
  mapOndcCatalogItemToBuyerItem,
} from './buyerCatalogCache';

const atta: UCPItem = {
  id: 'atta-1',
  name: 'Whole Wheat Atta 1kg',
  description: 'Stone-ground wheat flour',
  price: { currency: 'INR', value: '89.00' },
  images: [],
  category: 'Grocery',
};

const oil: UCPItem = {
  id: 'oil-1',
  name: 'Cold-Pressed Groundnut Oil 1L',
  description: 'Cooking oil',
  price: { currency: 'INR', value: '320.00' },
  images: [],
  category: 'Grocery',
};

describe('filterBuyerItemsForQuery', () => {
  it('does not present an unrelated product as a query match', () => {
    expect(filterBuyerItemsForQuery([atta], 'rice')).toEqual([]);
  });

  it('keeps category browse queries broad', () => {
    expect(filterBuyerItemsForQuery([atta], 'grocery')).toEqual([atta]);
  });

  it('matches names and descriptions case-insensitively', () => {
    expect(filterBuyerItemsForQuery([atta], 'WHEAT')).toEqual([atta]);
  });

  it('does not treat short misses as browse-all (tv must not return oil)', () => {
    expect(filterBuyerItemsForQuery([atta, oil], 'tv')).toEqual([]);
    expect(filterBuyerItemsForQuery([atta, oil], 'oil')).toEqual([oil]);
  });

  it('keeps TV out of the grocery lane even when mis-tagged Grocery', () => {
    const tv: UCPItem = {
      id: 'tv-1',
      name: 'Catalog Marker Horizon LED TV 32',
      description: '32 inch LED television',
      price: { currency: 'INR', value: '12999.00' },
      images: [],
      category: 'Grocery',
    };
    expect(filterBuyerItemsForCategory([tv, oil], 'grocery')).toEqual([oil]);
    expect(filterBuyerSearchResults([tv, oil], 'tv', 'grocery')).toEqual([]);
    expect(filterBuyerSearchResults([tv, oil], 'tv', 'electronics')).toEqual([tv]);
  });

  it('does not match rice via poha description alone', () => {
    const poha: UCPItem = {
      id: 'poha-1',
      name: 'Harvest House Poha 500g',
      description: 'Light, clean flattened rice for quick breakfasts and snacks.',
      price: { currency: 'INR', value: '78.00' },
      images: [],
      category: 'Grocery',
    };
    expect(filterBuyerItemsForQuery([poha, atta], 'rice')).toEqual([]);
    expect(filterBuyerItemsForQuery([poha, atta], 'poha')).toEqual([poha]);
    expect(filterBuyerItemsForQuery([poha], 'flattened rice')).toEqual([poha]);
  });

  it('preserves delivery areas from a network-shaped catalog item', () => {
    expect(
      mapOndcCatalogItemToBuyerItem({
        id: 'dal-1',
        name: 'Toor Dal',
        delivery_areas: ['Pune', '411001'],
      }).deliveryAreas,
    ).toEqual(['Pune', '411001']);
  });
});
