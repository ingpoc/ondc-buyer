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
