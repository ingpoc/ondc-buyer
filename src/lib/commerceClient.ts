import type { UCPItem, UCPOrder } from '../types';
import type { BuyerSupportCase } from '../types/agent';
import { throwIfSpaHtml } from './gatewayResponse';
import { TRUST_API_URL } from './identityUrls';
import { isLocalBrowserHost } from './loopback';
import { sellerDisplayName } from './displayText';

export interface DemoCommerceItem {
  item_id: string;
  version: number;
  status: string;
  seller_id: string;
  seller_name?: string;
  title: string;
  description: string;
  price_inr: number;
  inventory?: number;
  category_id?: string;
  delivery_estimate?: string;
  return_policy?: string;
  image_url?: string;
  image_caption?: string;
  delivery_areas?: string[];
  created_at: string;
  updated_at: string;
}

export interface DemoCommerceOrder {
  order_id: string;
  transaction_id: string;
  message_id: string;
  buyer_id: string;
  seller_id: string;
  seller_name?: string;
  item_id: string;
  item_title?: string;
  item_version: number;
  quantity: number;
  amount_inr: number;
  status: string;
  version?: number;
  fulfilment?: {
    status?: string;
    tracking_id?: string;
    tracking_url?: string;
    provider_name?: string;
    status_message?: string;
    history?: Array<{
      status: string;
      recorded_at: string;
      tracking_id?: string;
      status_message?: string;
    }>;
  };
  payment?: {
    status?: string;
    amount_inr?: number;
    reference_id?: string;
  };
  delivery_address?: UCPOrder['deliveryAddress'];
  authorization?: {
    decision?: string;
    reason_code?: string;
    receipt_id?: string;
    approval_id?: string | null;
    amount_inr?: number;
    recorded_at?: string;
  };
  created_at: string;
  updated_at: string;
}

interface DemoCommerceIssue {
  issue_id: string;
  order_id: string;
  status: string;
  reason: string;
  description: string;
  response?: string;
  remedy?: {
    type?: string;
    amount_inr?: number;
    message?: string;
  };
  outcome_receipt?: {
    receipt_id?: string;
    outcome?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface BuyerCommerceReturn {
  return_id: string;
  order_id: string;
  status: string;
  version: number;
  reason: string;
  resolution?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CommerceOrderTrack {
  order_id: string;
  status: string;
  tracking: {
    id: string;
    url?: string;
    status: string;
    location?: {
      gps?: string | null;
      address?: {
        city?: string;
        area_code?: string;
      };
      updated_at?: string;
    };
  };
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  detail?: string;
  message?: string;
}

async function demoFetch<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const base = isLocalBrowserHost() ? TRUST_API_URL : '';
  const response = await fetch(`${base}${endpoint}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  throwIfSpaHtml(response, 'Commerce request');
  const body = (await response.json().catch(() => ({}))) as Partial<ApiEnvelope<T>>;
  if (!response.ok || body.success === false) {
    throw new Error(body.detail || body.message || `Commerce request failed (${response.status})`);
  }
  return body.data as T;
}

export function mapDemoItemToBuyerItem(item: DemoCommerceItem): UCPItem {
  return {
    id: item.item_id,
    name: item.title,
    description: item.description,
    descriptor: {
      name: item.title,
      short_desc: item.description,
    },
    price: {
      currency: 'INR',
      value: item.price_inr.toFixed(2),
    },
    images: item.image_url ? [{ url: item.image_url }] : [],
    category: item.category_id || 'Grocery',
    quantity: item.inventory,
    _provider: item.seller_id || 'ONDC seller',
    provider: {
      id: item.seller_id || 'ondc-seller',
      name: item.seller_name,
    },
    deliveryEstimate: item.delivery_estimate,
    returnPolicy: item.return_policy,
    imageCaption: item.image_caption,
    deliveryAreas: item.delivery_areas,
  };
}

export function mapDemoOrderToBuyerOrder(order: DemoCommerceOrder): UCPOrder {
  const total = order.amount_inr;
  const unitPrice = total / Math.max(order.quantity, 1);
  const status = order.status === 'accepted' || order.status === 'confirmed'
    ? 'accepted'
    : order.status === 'preparing'
      ? 'in_progress'
      : order.status === 'shipped'
        ? 'shipped'
        : order.status === 'delivered' || order.status === 'fulfilled' || order.status === 'closed'
      ? 'delivered'
      : order.status === 'rejected' || order.status === 'cancelled'
        ? 'cancelled'
        : 'created';
  const paymentStatus = order.payment?.status === 'succeeded'
    ? 'completed'
    : order.payment?.status === 'reconciled'
      ? 'reconciled'
      : order.payment?.status === 'unknown'
        ? 'unknown'
        : order.payment?.status === 'pending'
          ? 'pending'
          : order.payment?.status === 'failed'
            ? 'failed'
            : undefined;
  return {
    id: order.order_id,
    status,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    provider: {
      id: order.seller_id,
      name: sellerDisplayName(order.seller_name, order.seller_id),
      verified: Boolean(order.seller_id),
    },
    items: [
      {
        id: order.item_id,
        name: order.item_title || order.item_id,
        quantity: order.quantity,
        price: { currency: 'INR', value: unitPrice.toFixed(2) },
      },
    ],
    quote: {
      total: { currency: 'INR', value: total.toFixed(2) },
      breakup: [],
    },
    fulfillment: {
      type: 'delivery',
      providerName: order.fulfilment?.provider_name,
      status:
        status === 'delivered'
          ? 'delivered'
          : status === 'cancelled'
            ? 'cancelled'
            : status === 'shipped'
              ? 'in_transit'
              : status === 'in_progress'
                ? 'pending'
                : 'pending',
      tracking: {
        id: order.fulfilment?.tracking_id,
        url: order.fulfilment?.tracking_url?.startsWith('https://')
          ? order.fulfilment.tracking_url
          : undefined,
        status: order.fulfilment?.status || status,
        statusMessage:
          order.fulfilment?.status_message ||
          (status === 'created'
            ? 'Order is awaiting seller confirmation.'
            : 'The latest seller fulfilment update is shown here.'),
      },
      history: order.fulfilment?.history?.map((event) => ({
        status: event.status,
        recordedAt: event.recorded_at,
        trackingId: event.tracking_id,
        statusMessage: event.status_message,
      })),
    },
    deliveryAddress: order.delivery_address,
    payment: paymentStatus
      ? {
          type: 'PRE-FULFILLMENT',
          status: paymentStatus,
          amount: {
            currency: 'INR',
            value: Number(order.payment?.amount_inr ?? total).toFixed(2),
          },
          transactionId: order.payment?.reference_id || order.message_id,
        }
      : undefined,
    authorization: order.authorization
      ? {
          decision: order.authorization.decision || 'allow',
          reason: order.authorization.approval_id
            ? 'Exact one-time approval was confirmed for this order.'
            : 'The order was within the active automatic checkout limit.',
          receiptReference: order.authorization.receipt_id,
          approvalReference: order.authorization.approval_id || undefined,
          amountInr: order.authorization.amount_inr,
          recordedAt: order.authorization.recorded_at,
        }
      : undefined,
  };
}

export function orderFromCommerceExecution(execution?: Record<string, unknown> | null): UCPOrder | null {
  const order = execution?.order;
  if (!order || typeof order !== 'object') return null;
  const durable = order as Record<string, unknown>;
  if (typeof durable.landed_total_paise === 'number') {
    const payment = execution?.payment_attempt as Record<string, unknown> | undefined;
    const durableStatus = String(durable.status || 'prepared');
    const status: UCPOrder['status'] = durableStatus === 'cancelled'
      ? 'cancelled'
      : durableStatus === 'delivered'
        ? 'delivered'
        : 'created';
    const paymentStatus = payment?.status === 'succeeded'
      ? 'completed'
      : payment?.status === 'reconciled'
        ? 'reconciled'
        : payment?.status === 'failed'
          ? 'failed'
          : payment?.status === 'unknown'
            ? 'unknown'
            : 'pending';
    return {
      id: String(durable.order_id),
      status,
      createdAt: String(durable.created_at),
      updatedAt: durable.updated_at ? String(durable.updated_at) : undefined,
      provider: { id: String(durable.seller_id || '') },
      items: [],
      quote: {
        total: {
          currency: 'INR',
          value: (durable.landed_total_paise / 100).toFixed(2),
        },
        breakup: [],
      },
      payment: {
        type: 'PRE-FULFILLMENT',
        status: paymentStatus,
        amount: {
          currency: 'INR',
          value: (Number(payment?.amount_paise ?? durable.landed_total_paise) / 100).toFixed(2),
        },
        transactionId: payment?.payment_attempt_id
          ? String(payment.payment_attempt_id)
          : undefined,
      },
    };
  }
  return mapDemoOrderToBuyerOrder(order as DemoCommerceOrder);
}

function mapDemoIssueToBuyerSupportCase(issue: DemoCommerceIssue): BuyerSupportCase {
  const allowedIssueTypes = ['cancellation', 'fulfillment', 'post_delivery', 'payment', 'other'] as const;
  const issueType = allowedIssueTypes.includes(issue.reason as (typeof allowedIssueTypes)[number])
    ? (issue.reason as BuyerSupportCase['issue_type'])
    : 'other';
  return {
    case_id: issue.issue_id,
    network_case_id: issue.issue_id,
    order_id: issue.order_id,
    issue_type: issueType,
    description: issue.description,
    evidence_links: [],
    status: ['accepted', 'closed', 'resolved'].includes(issue.status)
      ? 'resolved'
      : issue.status === 'open'
        ? 'open'
        : 'investigating',
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    resolution_note: issue.response ?? null,
    remedy: issue.remedy,
    outcome_receipt_id: issue.outcome_receipt?.receipt_id,
  };
}

export async function searchCommerceItems(query?: string) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const data = await demoFetch<{ items: DemoCommerceItem[]; count: number }>(`/api/demo-commerce/buyer/search${suffix}`);
  const items = data.items.map(mapDemoItemToBuyerItem);
  return {
    items,
    totalCount: items.length,
    __source: 'api',
  } as const;
}

export async function getCommerceItem(itemId: string) {
  const data = await demoFetch<{ item: DemoCommerceItem; inventory: number }>(
    `/api/demo-commerce/buyer/items/${itemId}`
  );
  return mapDemoItemToBuyerItem(data.item);
}

export async function listCommerceBuyerOrders() {
  const data = await demoFetch<{ orders: DemoCommerceOrder[]; count: number }>(
    '/api/demo-commerce/buyer/orders'
  );
  return data.orders.map(mapDemoOrderToBuyerOrder);
}

export async function getCommerceOrder(orderId: string) {
  const data = await demoFetch<{ order: DemoCommerceOrder }>(
    `/api/demo-commerce/buyer/orders/${orderId}`
  );
  return mapDemoOrderToBuyerOrder(data.order);
}

export async function getCommerceOrderTrack(orderId: string) {
  return demoFetch<CommerceOrderTrack>(`/api/ondc/track?order_id=${encodeURIComponent(orderId)}`);
}

export async function listCommerceBuyerIssues(orderId?: string) {
  const params = new URLSearchParams();
  if (orderId) params.set('order_id', orderId);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const data = await demoFetch<{ issues: DemoCommerceIssue[]; count: number }>(
    `/api/demo-commerce/buyer/issues${suffix}`
  );
  return data.issues.map(mapDemoIssueToBuyerSupportCase);
}

export async function createCommerceBuyerIssue(params: {
  orderId: string;
  reason: BuyerSupportCase['issue_type'];
  description: string;
}) {
  const data = await demoFetch<{ issue: DemoCommerceIssue }>(
    `/api/demo-commerce/buyer/orders/${encodeURIComponent(params.orderId)}/issues`,
    {
      method: 'POST',
      body: JSON.stringify({
        reason: params.reason,
        description: params.description,
      }),
    },
  );
  return mapDemoIssueToBuyerSupportCase(data.issue);
}

export async function listCommerceBuyerReturns(orderId?: string) {
  const params = new URLSearchParams();
  if (orderId) params.set('order_id', orderId);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const data = await demoFetch<{ returns: BuyerCommerceReturn[]; count: number }>(
    `/api/demo-commerce/buyer/returns${suffix}`,
  );
  return data.returns;
}
