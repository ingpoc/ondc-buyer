// Browser-safe types - copied from @ondc-sdk/shared to avoid pulling in Node.js dependencies
// These are minimal type definitions needed for frontend apps

// UCP types
export interface UCPSession {
  id: string;
  items: UCPSessionItem[];
  status: UCPSessionStatus;
  createdAt: string;
  updatedAt: string;
  buyer?: {
    name: string;
    email: string;
    phone: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
  };
}

export interface UCPSessionItem {
  id: string;
  item: BecknItem;
  quantity: number;
  addedAt: string;
}

export type UCPSessionStatus = 'active' | 'checkout' | 'ordered' | 'expired';

export interface UCPItem {
  id: string;
  name?: string;
  descriptor?: {
    name: string;
    short_desc?: string;
  };
  description?: string;
  price: UCPPrice;
  images: BecknImage[];
  category?: string;
  _provider?: string;
  provider?: BecknProvider;
  rating?: BecknRating;
  quantity?: number;
}

export interface UCPCatalog {
  items: UCPItem[];
}

export interface UCPPrice {
  value?: string;
  amount?: number;
  currency: string;
  price?: string;
}

export interface UCPAddress {
  name: string;
  phone: string;
  email?: string;
  street?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  postalCode?: string;
}

export interface UCPContact {
  name: string;
  phone: string;
  email?: string;
}

export interface UCPLocation {
  address?: UCPAddress;
  gps?: {
    latitude: number;
    longitude: number;
  };
}

export interface UCPQuote {
  price: UCPPrice;
  total: UCPPrice;
  subtotal: UCPPrice;
  deliveryCost?: UCPPrice;
  tax?: UCPPrice;
  discount?: UCPPrice;
  breakup: UCPQuoteBreakup[];
  taxes?: number;
  ttl?: string;
  currency?: string;
  amount?: {
    currency: string;
    value: string;
  };
}

export interface UCPQuoteBreakup {
  title: string;
  price: UCPPrice;
  type?: string;
  quantity?: number;
}

export interface UCPFulfillment {
  id?: string;
  type: string;
  state?: string;
  status: 'pending' | 'searching_agent' | 'agent_assigned' | 'picking_up' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled';
  providerName?: string;
  estimatedTime?: { start?: string; end?: string };
  tracking?: {
    id?: string;
    url?: string;
    status?: string;
    statusMessage?: string;
    estimatedDelivery?: string;
  };
  agent?: {
    name?: string;
    phone?: string;
    image?: string;
  };
}

export type UCPOrderStatus =
  | 'created'
  | 'accepted'
  | 'in_progress'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type UCPFulfillmentStatus =
  | 'pending'
  | 'processing'
  | 'packed'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'searching_agent'
  | 'agent_assigned'
  | 'picking_up'
  | 'picked_up'
  | 'in_transit';

export interface UCPPayment {
  type:
    | 'PRE-FULFILLMENT'
    | 'ON-FULFILLMENT'
    | 'POST-FULFILLMENT'
    | 'upi'
    | 'card'
    | 'netbanking'
    | 'wallet'
    | 'cod';
  status: 'PAID' | 'NOT-PAID' | 'completed' | 'failed';
  amount?: {
    currency: string;
    value: string;
  };
  transactionId?: string;
  completedAt?: string;
}

export interface UCPSearchPreferences {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  location?: UCPLocation;
}

export interface UCPSearchQuery {
  query: string;
  category?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

// Beckn types (minimal subset for frontend)
export interface BecknItem {
  id: string;
  name: string;
  description?: string;
  price: BecknPrice;
  images: BecknImage[];
  category: BecknCategory;
  descriptor?: {
    name: string;
    short_desc?: string;
  };
  category_id?: string;
}

export interface BecknCatalog {
  items: BecknItem[];
  'bpp/providers'?: any[];
}

export interface BecknProvider {
  id: string;
  name: string;
  location: BecknLocation;
  verified?: boolean;
  rating?: BecknRating;
}

export interface BecknOffer {
  id: string;
  price: BecknPrice;
}

export interface BecknPrice {
  value?: string;
  amount?: number;
  currency: string;
}

export interface BecknFulfillment {
  id: string;
  type: string;
}

export interface BecknLocation {
  address?: BecknAddress;
  gps?: {
    latitude: number;
    longitude: number;
  };
}

export interface BecknAddress {
  name: string;
  phone: string;
  email?: string;
  street?: string;
  city?: BecknCity;
  state?: BecknState;
  country?: BecknCountry;
  pincode?: string;
}

export interface BecknContact {
  name: string;
  phone: string;
  email?: string;
}

export interface BecknImage {
  url: string;
}

export interface BecknDescriptor {
  name: string;
}

export interface BecknRating {
  value: number;
}

export interface BecknContext {
  domain: BecknDomain;
  action: BecknAction;
  timestamp: string;
}

export type BecknDomain =
  | 'nic2004:52110'
  | 'nic2004:52211'
  | 'nic2004:52311';

export type BecknAction =
  | 'search'
  | 'select'
  | 'init'
  | 'confirm'
  | 'status'
  | 'track'
  | 'cancel'
  | 'on_search'
  | 'on_select'
  | 'on_init'
  | 'on_confirm'
  | 'on_status'
  | 'on_track'
  | 'on_cancel';

export interface BecknCity {
  name: string;
}

export interface BecknState {
  name: string;
}

export interface BecknCountry {
  name: string;
}

export interface BecknCategory {
  name: string;
}

export interface UCPOrder {
  id: string;
  status: UCPOrderStatus;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: UCPPrice;
    customizations?: Record<string, string>;
    status?: UCPOrderStatus;
  }>;
  total: number;
  createdAt: string;
  updatedAt: string;
  provider?: BecknProvider;
  buyer?: {
    name: string;
    email: string;
    phone: string;
    contact?: {
      phone?: string;
      email?: string;
    };
  };
  deliveryAddress?: UCPAddress;
  fulfillment?: UCPFulfillment;
  payment?: UCPPayment;
  quote?: UCPQuote;
  documents?: Array<{
    id: string;
    url: string;
    name: string;
    type: string;
    label?: string;
  }>;
  cancellation?: {
    cancelledBy?: 'buyer' | 'seller' | 'system';
    reason?: string;
    cancelledAt?: string;
    refundedAmount?: number;
    refund?: {
      status: string;
      amount: UCPPrice;
      transactionId?: string;
      completedAt?: string;
    };
  };
}

