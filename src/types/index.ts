// Browser-safe types copied locally so the buyer app does not depend on a missing
// shared package during local development.

export interface AuthUser {
  wallet_address: string;
  pda_address?: string;
  owner_pubkey?: string;
  created_at: number;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (returnUrl?: string) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

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
    contact?: {
      email?: string;
      phone?: string;
    };
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
  name?: string;
  phone?: string;
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
  status:
    | 'pending'
    | 'searching_agent'
    | 'agent_assigned'
    | 'picking_up'
    | 'picked_up'
    | 'in_transit'
    | 'out_for_delivery'
    | 'delivered'
    | 'cancelled';
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

export interface UCPOrder {
  id: string;
  status: UCPOrderStatus;
  createdAt: string;
  updatedAt?: string;
  provider?: BecknProvider & {
    verified?: boolean;
  };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: UCPPrice;
    customizations?: Record<string, string>;
  }>;
  quote?: {
    total?: UCPPrice;
    breakup?: UCPQuoteBreakup[];
  };
  billing?: UCPAddress;
  deliveryAddress?: UCPAddress;
  fulfillment?: UCPFulfillment;
  fulfillments?: UCPFulfillment[];
  payment?: UCPPayment;
  cancellation?: {
    cancelledBy: string;
    reason?: string;
    cancelledAt?: string;
    refund?: {
      amount: {
        currency: string;
        value: string;
      };
      status: string;
    };
  };
  documents?: Array<{
    url: string;
    label?: string;
    type?: string;
  }>;
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

export interface BecknItem {
  id: string;
  name?: string;
  description?: string;
  price: BecknPrice;
  images: BecknImage[];
  category?: BecknCategory;
  descriptor?: {
    name: string;
    short_desc?: string;
  };
  category_id?: string;
  quantity?: number;
}

export interface BecknCatalog {
  items: BecknItem[];
  'bpp/providers'?: Array<{
    items?: BecknItem[];
  }>;
}

export interface BecknProvider {
  id: string;
  name?: string;
}

export interface BecknCategory {
  id?: string;
  descriptor?: {
    name?: string;
  };
}

export interface BecknImage {
  url: string;
}

export interface BecknPrice {
  value?: string;
  currency: string;
}

export interface BecknRating {
  value?: number;
  count?: number;
}

export interface CartItemProps {
  item: {
    item: { id: string; descriptor?: { name: string }; price?: { value?: string; currency: string } };
    quantity: number;
  };
  onUpdateQuantity: (itemId: string, quantity: number) => Promise<void>;
  onRemove: (itemId: string) => Promise<void>;
  disabled: boolean;
}

export interface CartSummaryProps {
  subtotal: number;
  currency: string;
  onCheckout: () => void;
  checkoutDisabled: boolean;
}
