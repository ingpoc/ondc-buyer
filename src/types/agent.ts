import type { BecknItem } from '.';
import type { PortfolioTrustState } from '@/lib/trust';

export type AgentAuthMode = 'api_key' | 'local_cli' | 'bedrock' | 'vertex' | 'azure' | 'unavailable';

export interface UsageSnapshot {
  requests_used: number;
  requests_limit: number;
  period_start: string;
  period_end: string;
  estimated_cost_usd: number;
}

export interface AgentRuntimeSnapshot {
  app_id: 'ondc-buyer';
  auth_mode: AgentAuthMode;
  model: string;
  runtime_available: boolean;
  agent_access: boolean;
  trust_state: PortfolioTrustState;
  trust_required_for_write: boolean;
  mode: 'blocked' | 'read_only' | 'full';
  usage: UsageSnapshot;
  allowed_capabilities: string[];
  blocked_reason: string | null;
}

export interface AgentSessionSummary {
  app_id: 'ondc-buyer';
  session_id: string;
  sdk_session_id: string | null;
  subject_id: string;
  trust_state: PortfolioTrustState;
  mode: 'blocked' | 'read_only' | 'full';
  allowed_capabilities: string[];
  context?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BuyerAgentSnapshot {
  route: {
    path: string;
    search: string;
  };
  trust: {
    state: PortfolioTrustState;
    write_enabled: boolean;
  };
  catalog: {
    total_items: number;
    items: Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      price: string;
      provider: string;
    }>;
  };
  cart: {
    session_id: string;
    item_count: number;
    subtotal: string;
    items: Array<{
      item_id: string;
      name: string;
      quantity: number;
      price: string;
    }>;
    buyer_profile_ready: boolean;
  };
  orders: {
    total: number;
    recent: Array<{
      id: string;
      status: string;
      total: string;
      provider_name: string;
      created_at: string;
    }>;
  };
}

export interface BuyerMoney {
  currency: string;
  value: string;
}

export interface BuyerCartLine {
  item_id: string;
  title: string;
  quantity: number;
  unit_price: BuyerMoney;
  provider_name: string;
}

export interface BuyerCartSessionSnapshot {
  session_id: string;
  items: BuyerCartLine[];
  buyer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

export interface BuyerOrderRecord {
  id: string;
  status:
    | 'created'
    | 'accepted'
    | 'in_progress'
    | 'packed'
    | 'shipped'
    | 'out_for_delivery'
    | 'delivered'
    | 'cancelled'
    | 'returned';
  createdAt: string;
  updatedAt: string;
  provider: {
    id: string;
    name: string;
    verified: boolean;
  };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: BuyerMoney;
  }>;
  quote: {
    total: BuyerMoney;
    breakup: Array<{
      title: string;
      type: 'item' | 'delivery' | 'tax';
      price: BuyerMoney;
    }>;
  };
  fulfillment: {
    type: 'delivery';
    status: 'pending' | 'processing' | 'packed' | 'out_for_delivery' | 'delivered' | 'cancelled';
    providerName: string;
    estimatedTime: {
      start: string;
      end: string;
    };
    tracking: {
      status: string;
      statusMessage: string;
    };
  };
  payment: {
    type: 'upi';
    status: 'PAID' | 'NOT-PAID' | 'failed';
    amount: BuyerMoney;
  };
  cancellation?: {
    cancelledBy: string;
    reason?: string;
    cancelledAt?: string;
    refund?: {
      amount: BuyerMoney;
      status: string;
    };
  };
}

export interface BuyerSupportCase {
  case_id: string;
  order_id: string;
  issue_type: 'cancellation' | 'fulfillment' | 'post_delivery' | 'payment' | 'other';
  description: string;
  evidence_links: string[];
  network_case_id: string;
  status: 'open' | 'investigating' | 'resolved';
  created_at: string;
  updated_at: string;
  resolution_note?: string | null;
}

export interface BuyerRecommendItemAction {
  type: 'recommend_item';
  item_id: string;
  reason: string;
}

export interface BuyerCartAddAction {
  type: 'cart_add';
  item_id: string;
  quantity: number;
  reason: string;
}

export interface BuyerNavigateAction {
  type: 'navigate';
  path: string;
  reason: string;
}

export interface BuyerTrustRequiredAction {
  type: 'trust_required';
  operation: string;
  reason: string;
  suggested_path?: string;
}

export interface BuyerUnsupportedAction {
  type: 'unsupported';
  reason: string;
}

export type BuyerAgentAction =
  | BuyerRecommendItemAction
  | BuyerCartAddAction
  | BuyerNavigateAction
  | BuyerTrustRequiredAction
  | BuyerUnsupportedAction;

export interface BuyerAgentResponseEnvelope {
  summary: string;
  actions: BuyerAgentAction[];
}

export interface ShoppingIntent {
  raw_text: string;
  action: 'shop' | 'confirm' | 'track' | 'cancel' | 'issue' | 'issue_status' | 'status';
  product_query: string | null;
  quantity: number | null;
  budget_max_inr: number | null;
  preferences: string[];
  delivery_window: string | null;
  order_reference: string | null;
  issue_type: BuyerSupportCase['issue_type'] | null;
  issue_description: string | null;
}

export interface StructuredShoppingTask {
  query: string;
  quantity: number;
  budget_max_inr: number | null;
  preferences: string[];
  delivery_window: string | null;
  missing_fields: string[];
}

export interface CandidateOffer {
  candidate_id: string;
  item_id: string;
  title: string;
  provider_id: string;
  provider_name: string;
  quantity: number;
  unit_price: BuyerMoney;
  total_price: BuyerMoney;
  rating: number | null;
  delivery_eta: string;
  payment_modes: string[];
  cancellation_terms: string;
  substitution_policy: string;
  ranking_reason: string;
}

export interface OfferSelection {
  candidate_id: string;
  selected_at: string;
  reason: string;
}

export interface DraftCheckout {
  draft_id: string;
  candidate_id: string;
  item_title: string;
  quantity: number;
  provider_name: string;
  payment_mode: string;
  delivery_estimate: string;
  cancellation_terms: string;
  substitution_policy: string;
  charge_breakup: Array<{
    title: string;
    type: 'item' | 'delivery' | 'tax';
    amount: BuyerMoney;
  }>;
  total: BuyerMoney;
  expires_at: string;
  missing_fields: string[];
  ready_for_confirmation: boolean;
}

export interface FinalConfirmation {
  confirmed_by_subject_id: string;
  confirmed_at: string;
  confirmation_note: string;
}

export interface BuyerBrowserState {
  cart_session?: BuyerCartSessionSnapshot | null;
  recent_orders?: BuyerOrderRecord[];
  support_cases?: BuyerSupportCase[];
  active_route?: string | null;
}

export interface BuyerAgentTaskState {
  intent: ShoppingIntent | null;
  structured_task: StructuredShoppingTask | null;
  execution_state:
    | 'idle'
    | 'needs_clarification'
    | 'search_ready'
    | 'results_ready'
    | 'draft_ready'
    | 'awaiting_confirmation'
    | 'order_confirmed'
    | 'support_active';
  candidate_results: CandidateOffer[];
  selected_offer: OfferSelection | null;
  draft_checkout: DraftCheckout | null;
  final_confirmation: FinalConfirmation | null;
  active_order: BuyerOrderRecord | null;
  support_cases: BuyerSupportCase[];
  clarifying_questions: string[];
  last_adapter_operation:
    | 'intent_parse'
    | 'search_catalog'
    | 'select_offer'
    | 'prepare_checkout'
    | 'confirm_order'
    | 'get_order_status'
    | 'cancel_order'
    | 'create_support_case'
    | 'get_support_case_status'
    | null;
  browser_state: BuyerBrowserState;
  post_order_context: {
    latest_order_id: string | null;
    latest_support_case_id: string | null;
  };
}

export type BuyerClientPatch =
  | { patch_type: 'replace_cart'; cart_session: BuyerCartSessionSnapshot }
  | { patch_type: 'upsert_order'; order: BuyerOrderRecord }
  | { patch_type: 'upsert_support_case'; support_case: BuyerSupportCase };

export interface BuyerAgentPatchResult {
  summary: string;
  actions: BuyerAgentAction[];
  itemsToAdd: Array<{
    item: BecknItem;
    quantity: number;
  }>;
  navigateTo: string | null;
  trustBlockReason: string | null;
}
