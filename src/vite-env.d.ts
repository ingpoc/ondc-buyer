/// <reference types="vite/client" />

interface ImportMetaEnv {
  // SSO/Identity Provider
  readonly VITE_IDENTITY_URL: string
  readonly VITE_IDENTITY_WEB_URL: string
  readonly VITE_TRUST_API_URL: string

  // Backend API
  readonly VITE_API_BASE_URL: string
  readonly VITE_COMMERCE_DEMO_MODE?: string

  // ONDC Staging Environment
  readonly VITE_ONDC_REGISTRY_URL: string
  readonly VITE_ONDC_GATEWAY_URL: string

  // ONDC Network Configuration
  readonly VITE_ONDC_DOMAIN: string
  readonly VITE_ONDC_COUNTRY: string
  readonly VITE_ONDC_CITY: string

  // Subscriber Identity
  readonly VITE_ONDC_SUBSCRIBER_ID: string
  readonly VITE_ONDC_SUBSCRIBER_URL: string
  readonly VITE_ONDC_BAP_ID: string
  readonly VITE_ONDC_BAP_URI: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
