import { normalizeLoopbackUrl } from './loopback';

const RAW_AGENT_CONTROL_PLANE_BASE = import.meta.env.VITE_AGENT_CONTROL_PLANE_URL?.trim() || '';

export const AGENT_CONTROL_PLANE_BASE = RAW_AGENT_CONTROL_PLANE_BASE
  ? normalizeLoopbackUrl(RAW_AGENT_CONTROL_PLANE_BASE).replace(/\/$/, '')
  : '';

export function buildAgentControlPlaneUrl(path: string) {
  return AGENT_CONTROL_PLANE_BASE ? `${AGENT_CONTROL_PLANE_BASE}${path}` : path;
}
