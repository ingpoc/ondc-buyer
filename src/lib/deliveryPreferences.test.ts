import { beforeEach, describe, expect, it } from 'vitest';
import {
  deliveryAreaLabel,
  loadSavedDeliveryArea,
  saveDeliveryAreaFromAddress,
  saveDeliveryAreaLabel,
} from './deliveryPreferences';

describe('saved delivery area', () => {
  beforeEach(() => localStorage.clear());

  it('stores structured checkout location per signed-in principal', () => {
    expect(
      deliveryAreaLabel({ city: 'Pune', state: 'Maharashtra', postalCode: '411001' }),
    ).toBe('Pune, Maharashtra, 411001');

    saveDeliveryAreaFromAddress('principal:buyer:a', {
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
    });

    expect(loadSavedDeliveryArea('principal:buyer:a')).toMatchObject({
      label: 'Pune, Maharashtra, 411001',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
    });
    expect(loadSavedDeliveryArea('principal:buyer:b')).toBeNull();
  });

  it('uses an explicit search area as a checkout city or PIN fallback', () => {
    saveDeliveryAreaLabel('principal:buyer:a', 'Pune');
    expect(loadSavedDeliveryArea('principal:buyer:a')).toMatchObject({ city: 'Pune' });

    saveDeliveryAreaLabel('principal:buyer:b', '411001');
    expect(loadSavedDeliveryArea('principal:buyer:b')).toMatchObject({ postalCode: '411001' });
  });
});
