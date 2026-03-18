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
