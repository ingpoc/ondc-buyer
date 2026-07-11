/**
 * ONDC / Beckn protocol client scaffold.
 *
 * Demo commerce stays on VITE_COMMERCE_DEMO_MODE=true.
 * When demo is off, buyer hooks should call this client against a real BAP/BPP.
 * Not wired end-to-end until portal whitelist + signing keys exist.
 */

export interface OndcProtocolEnv {
  VITE_ONDC_SUBSCRIBER_ID?: string;
  VITE_ONDC_BAP_URI?: string;
  VITE_ONDC_GATEWAY_URL?: string;
  VITE_ONDC_REGISTRY_URL?: string;
}

export function resolveOndcProtocolConfig(env: OndcProtocolEnv) {
  const subscriberId = env.VITE_ONDC_SUBSCRIBER_ID?.trim() || '';
  const bapUri = env.VITE_ONDC_BAP_URI?.trim() || '';
  const gatewayUrl = env.VITE_ONDC_GATEWAY_URL?.trim() || '';
  const registryUrl = env.VITE_ONDC_REGISTRY_URL?.trim() || '';
  const configured = Boolean(subscriberId && bapUri && gatewayUrl);

  return {
    subscriberId,
    bapUri,
    gatewayUrl,
    registryUrl,
    configured,
  };
}

const config = resolveOndcProtocolConfig(import.meta.env);

export const ONDC_PROTOCOL_CONFIGURED = config.configured;

export function requireOndcProtocol() {
  if (!config.configured) {
    throw new Error(
      'ONDC protocol not configured. Set VITE_ONDC_SUBSCRIBER_ID, VITE_ONDC_BAP_URI, VITE_ONDC_GATEWAY_URL and disable demo mode.'
    );
  }
  return config;
}

/** Placeholder — real Beckn search/select/init/confirm land here after NP onboarding. */
export async function ondcSearch(_intent: Record<string, unknown>): Promise<never> {
  requireOndcProtocol();
  throw new Error('ONDC search not implemented yet — protocol client scaffold only.');
}
