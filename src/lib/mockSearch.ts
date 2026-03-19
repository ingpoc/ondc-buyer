import type { UCPItem } from '../types';

const MOCK_BUYER_ITEMS: UCPItem[] = [
  {
    id: 'basmati-rice-5kg',
    name: 'Basmati Rice 5kg',
    description: 'Premium long-grain rice suited for pantry-stock buyer validation.',
    descriptor: {
      name: 'Basmati Rice 5kg',
      short_desc: 'Pantry staple for local buyer-browser testing.',
    },
    price: {
      currency: 'INR',
      value: '640.00',
    },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
      },
    ],
    category: 'grocery',
    _provider: 'Verified Pantry Co.',
  },
  {
    id: 'mustard-oil-1l',
    name: 'Cold Pressed Mustard Oil 1L',
    description: 'Kitchen staple used to validate buyer trust-gated discovery and cart flows.',
    descriptor: {
      name: 'Cold Pressed Mustard Oil 1L',
      short_desc: 'Local discovery fallback with quick-add support.',
    },
    price: {
      currency: 'INR',
      value: '285.00',
    },
    images: [],
    category: 'grocery',
    _provider: 'Verified Pantry Co.',
  },
  {
    id: 'filter-coffee-500g',
    name: 'Filter Coffee Blend 500g',
    description: 'Mock catalog item for search and product-detail browser validation.',
    descriptor: {
      name: 'Filter Coffee Blend 500g',
      short_desc: 'Demo listing for buyer journey coverage.',
    },
    price: {
      currency: 'INR',
      value: '349.00',
    },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80',
      },
    ],
    category: 'grocery',
    _provider: 'Morning Roast',
  },
];

export function getMockBuyerItems(): UCPItem[] {
  return MOCK_BUYER_ITEMS.map((item) => ({
    ...item,
    descriptor: item.descriptor ? { ...item.descriptor } : item.descriptor,
    price: item.price ? { ...item.price } : item.price,
    images: Array.isArray(item.images) ? item.images.map((image) => ({ ...image })) : item.images,
  }));
}

function filterItems(endpoint: string) {
  const [, query = ''] = endpoint.split('?');
  const params = new URLSearchParams(query);
  const term = (params.get('q') || '').trim().toLowerCase();
  const category = (params.get('category') || '').trim().toLowerCase();

  const items = getMockBuyerItems().filter((item) => {
    const haystack = [
      item.name,
      item.description,
      item.descriptor?.name,
      item.descriptor?.short_desc,
      item._provider,
      item.category,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchesCategory = !category || String(item.category || '').toLowerCase() === category;
    const matchesTerm = !term || haystack.includes(term);
    return matchesCategory && matchesTerm;
  });

  return {
    items,
    totalCount: items.length,
  };
}

export function resolveMockBuyerEndpoint(endpoint: string): unknown | null {
  if (endpoint.startsWith('/api/search?')) {
    return filterItems(endpoint);
  }

  if (endpoint.startsWith('/api/catalog/products/')) {
    const id = endpoint.split('/').pop() || '';
    return getMockBuyerItems().find((item) => item.id === id) || null;
  }

  return null;
}
