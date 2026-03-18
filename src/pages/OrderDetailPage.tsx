import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { UCPOrder, UCPOrderStatus, UCPFulfillmentStatus } from '../types';
import { PageLayout, DRAMS, COLORS, SPACING, TYPOGRAPHY, BUTTON, CARD, BADGE } from '@portfolio-ui';
import { COMMERCE_DEMO_MODE } from '../lib/commerceConfig';
import { cancelDemoOrder, getDemoOrder } from '../lib/localOrders';

// Mock order fetch - to be replaced with API call
const fetchOrder = async (orderId: string): Promise<UCPOrder | null> => {
  if (COMMERCE_DEMO_MODE) {
    return getDemoOrder(orderId);
  }
  void orderId;
  // TODO: Replace with actual API call
  return null;
};

// Order statuses that can be cancelled
const CANCELLABLE_STATUSES: UCPOrderStatus[] = ['created', 'accepted', 'in_progress'];

const isCancellable = (status: UCPOrderStatus): boolean => CANCELLABLE_STATUSES.includes(status);

const getOrderStatusLabel = (status: UCPOrderStatus): string => {
  const labels: Record<UCPOrderStatus, string> = {
    created: 'Created',
    accepted: 'Accepted',
    in_progress: 'In Progress',
    packed: 'Packed',
    shipped: 'Shipped',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    returned: 'Returned',
  };
  return labels[status] || status;
};

const getOrderStatusBadgeVariant = (status: UCPOrderStatus): keyof typeof BADGE => {
  if (status === 'cancelled' || status === 'returned') return 'error';
  if (status === 'delivered') return 'success';
  if (status === 'created' || status === 'accepted') return 'info';
  if (status === 'in_progress' || status === 'packed' || status === 'shipped' || status === 'out_for_delivery') return 'warning';
  return 'success';
};

const getFulfillmentStatusLabel = (status: UCPFulfillmentStatus): string => {
  const labels: Record<UCPFulfillmentStatus, string> = {
    pending: 'Pending',
    processing: 'Processing',
    packed: 'Packed',
    searching_agent: 'Searching for Agent',
    agent_assigned: 'Agent Assigned',
    picking_up: 'Picking Up',
    picked_up: 'Picked Up',
    in_transit: 'In Transit',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
};

const formatPrice = (currency: string, value: string | undefined, quantity: number = 1): string => {
  const numValue = value ? parseFloat(value) : 0;
  return `${currency} ${(numValue * quantity).toFixed(2)}`;
};

const BACK_BUTTON_STYLE = {
  ...BUTTON.secondary,
  marginBottom: SPACING.xl,
};

const HEADER_STYLE = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: SPACING.xl,
  paddingBottom: SPACING.xl,
  borderBottom: `1px solid ${DRAMS.grayTrack}`,
};

const LOADING_STYLE = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: SPACING['3xl'],
  color: DRAMS.textLight,
  ...TYPOGRAPHY.body,
};

const ERROR_STYLE = {
  ...CARD.base,
  backgroundColor: '#fef2f2',
  borderColor: '#fecaca',
  color: COLORS.error,
  textAlign: 'center' as const,
};

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<UCPOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Load order data
  useEffect(() => {
    const loadOrder = async () => {
      if (!id) {
        setError('Order ID is required');
        setLoading(false);
        return;
      }

      try {
        const data = await fetchOrder(id);
        if (!data) {
          setError('Order not found');
        } else {
          setOrder(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [id]);

  const handleCancel = async () => {
    if (!order || !id) return;

    if (!confirm('Are you sure you want to cancel this order?')) {
      return;
    }

    setCancelling(true);
    try {
      if (COMMERCE_DEMO_MODE) {
        const updatedOrder = cancelDemoOrder(id);
        if (!updatedOrder) {
          throw new Error('Order not found');
        }
        setOrder(updatedOrder);
        return;
      }

      // TODO: Replace with actual API call
      // const response = await fetch(`/api/orders/${id}/cancel`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ reason: 'Buyer requested cancellation' }),
      // });
      //
      // if (!response.ok) throw new Error('Failed to cancel order');
      //
      // const updatedOrder = (await response.json()).order as UCPOrder;
      // setOrder(updatedOrder);

      // Mock cancellation for now
      setOrder({
        ...order,
        status: 'cancelled',
        cancellation: {
          cancelledBy: 'buyer',
          cancelledAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div style={LOADING_STYLE}>Loading order details...</div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div style={ERROR_STYLE}>
          <p style={{ margin: 0, ...BADGE.error }}>Error: {error}</p>
          <button onClick={() => navigate('/orders')} style={BACK_BUTTON_STYLE}>
            Back to Orders
          </button>
        </div>
      </PageLayout>
    );
  }

  if (!order) {
    return (
      <PageLayout>
        <div style={LOADING_STYLE}>Order not found</div>
      </PageLayout>
    );
  }

  const canCancel = isCancellable(order.status);

  return (
    <PageLayout>
      {/* Back button */}
      <button onClick={() => navigate('/orders')} style={BACK_BUTTON_STYLE}>
        ← Back to Orders
      </button>

      {/* Order Header */}
      <div style={HEADER_STYLE}>
        <div>
          <h1 style={{ margin: `0 0 ${SPACING.sm} 0`, ...TYPOGRAPHY.h2 }}>Order #{order.id}</h1>
          <p style={{ margin: '0', ...TYPOGRAPHY.body, color: COLORS.textSecondary }}>
            Placed on {new Date(order.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div
          style={{
            ...BADGE.base,
            ...BADGE[getOrderStatusBadgeVariant(order.status)],
          }}
        >
          {getOrderStatusLabel(order.status)}
        </div>
      </div>

      {/* Cancellation Notice */}
      {order.cancellation && (
        <div
          style={{
            ...BADGE.error,
            marginBottom: SPACING.xl,
          }}
        >
          <p style={{ margin: `0 0 ${SPACING.sm} 0`, ...TYPOGRAPHY.label }}>Order Cancelled</p>
          <p style={{ margin: '0', color: COLORS.error }}>
            Cancelled by: {order.cancellation.cancelledBy}
            {order.cancellation.reason && ` - ${order.cancellation.reason}`}
          </p>
          <p style={{ margin: `${SPACING.xs} 0 0 0`, ...TYPOGRAPHY.bodySmall }}>
            {new Date(order.cancellation.cancelledAt || '').toLocaleString()}
          </p>
          {order.cancellation.refund && (
            <p style={{ margin: `${SPACING.sm} 0 0 0`, color: COLORS.success, ...TYPOGRAPHY.bodySmall }}>
              Refund: {order.cancellation.refund.amount.currency}{' '}
              {order.cancellation.refund.amount.value} - {order.cancellation.refund.status}
            </p>
          )}
        </div>
      )}

      {/* Provider Info */}
      <div
        style={{
          ...CARD.base,
          backgroundColor: COLORS.bgPage,
          marginBottom: SPACING.xl,
        }}
      >
        <h3 style={{ margin: `0 0 ${SPACING.sm} 0`, ...TYPOGRAPHY.h3 }}>Seller</h3>
        <p style={{ margin: '0', ...TYPOGRAPHY.label }}>{order.provider?.name}</p>
        {order.provider?.verified && (
          <span style={{ color: COLORS.success, ...TYPOGRAPHY.bodySmall }}>✓ Verified</span>
        )}
      </div>

      {/* Order Items */}
      <div style={{ marginBottom: SPACING.xl }}>
        <h2 style={{ ...TYPOGRAPHY.h3, marginBottom: SPACING.lg }}>Items</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
          {order.items.map((item) => (
            <div
              key={item.id}
              style={{
                ...CARD.base,
                display: 'flex',
                justifyContent: 'space-between',
                padding: SPACING.lg,
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ margin: `0 0 ${SPACING.xs} 0`, ...TYPOGRAPHY.label }}>{item.name}</p>
                <p style={{ margin: `0 0 ${SPACING.xs} 0`, ...TYPOGRAPHY.body, color: COLORS.textSecondary }}>
                  Quantity: {item.quantity}
                </p>
                {item.customizations && (
                  <p style={{ margin: `${SPACING.xs} 0 0 0`, ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary }}>
                    {Object.entries(item.customizations).map(([key, value]) => (
                      <span key={key}>
                        {key}: {value}
                      </span>
                    )).join(' | ')}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: `0 0 ${SPACING.xs} 0`, ...TYPOGRAPHY.label }}>
                  {formatPrice(item.price.currency, (item.price.value ?? String(item.price.amount ?? 0)), item.quantity)}
                </p>
                <p style={{ margin: `0 0 ${SPACING.xs} 0`, ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary }}>
                  {item.price.currency} {item.price.value ?? item.price.amount} each
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quote/Pricing Breakdown */}
      <div
        style={{
          ...CARD.base,
          marginBottom: SPACING.xl,
        }}
      >
        <h2 style={{ ...TYPOGRAPHY.h3, marginBottom: SPACING.lg }}>Order Summary</h2>
        {order.quote?.breakup?.map((item, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: SPACING.sm,
              ...TYPOGRAPHY.body,
            }}
          >
            <span style={{ color: COLORS.textSecondary }}>{item.title}</span>
            <span>{item.price.currency} {item.price.value ?? item.price.amount}</span>
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: SPACING.lg,
            paddingTop: SPACING.md,
            borderTop: `1px solid ${COLORS.border}`,
            ...TYPOGRAPHY.label,
          }}
        >
          <span>Total</span>
          <span>
            {order.quote?.total?.currency} {order.quote?.total?.value ?? order.quote?.total?.amount}
          </span>
        </div>
      </div>

      {/* Delivery Address */}
      <div style={{ marginBottom: SPACING.xl }}>
        <h2 style={{ ...TYPOGRAPHY.h3, marginBottom: SPACING.md }}>Delivery Address</h2>
        <div style={{ color: COLORS.textPrimary, lineHeight: 1.6 }}>
          <p style={{ margin: `0 0 ${SPACING.xs} 0`, ...TYPOGRAPHY.label }}>
            {order.deliveryAddress?.line1}
          </p>
          {order.deliveryAddress?.line2 && (
            <p style={{ margin: `0 0 ${SPACING.xs} 0` }}>{order.deliveryAddress.line2}</p>
          )}
          <p style={{ margin: `0 0 ${SPACING.xs} 0` }}>
            {order.deliveryAddress?.city}, {order.deliveryAddress?.state}{' '}
            {order.deliveryAddress?.postalCode}
          </p>
          <p style={{ margin: '0' }}>{order.deliveryAddress?.country}</p>
        </div>
      </div>

      {/* Fulfillment & Tracking */}
      <div style={{ marginBottom: SPACING.xl }}>
        <h2 style={{ ...TYPOGRAPHY.h3, marginBottom: SPACING.md }}>
          {order.fulfillment?.type === 'delivery' ? 'Delivery' : 'Fulfillment'} Status
        </h2>
        <div
          style={{
            ...CARD.base,
            backgroundColor: COLORS.bgPage,
          }}
        >
          <p style={{ margin: `0 0 ${SPACING.sm} 0`, ...TYPOGRAPHY.label }}>
            Status: {getFulfillmentStatusLabel(order.fulfillment?.status ?? 'pending')}
          </p>
          {order.fulfillment?.estimatedTime && (
            <p style={{ margin: `0 0 ${SPACING.sm} 0`, ...TYPOGRAPHY.body, color: COLORS.textSecondary }}>
              Est. Delivery:{' '}
              {order.fulfillment.estimatedTime.start
                ? new Date(order.fulfillment.estimatedTime.start).toLocaleString()
                : 'TBD'}{' '}
              -{' '}
              {order.fulfillment.estimatedTime.end
                ? new Date(order.fulfillment.estimatedTime.end).toLocaleString()
                : 'TBD'}
            </p>
          )}
          {order.fulfillment?.providerName && (
            <p style={{ margin: `0 0 ${SPACING.sm} 0`, ...TYPOGRAPHY.body, color: COLORS.textSecondary }}>
              Provider: {order.fulfillment?.providerName}
            </p>
          )}

          {/* Tracking Info */}
          {order.fulfillment?.tracking && (
            <div style={{ marginTop: SPACING.md, paddingTop: SPACING.md, borderTop: `1px solid ${COLORS.border}` }}>
              <p style={{ margin: `0 0 ${SPACING.sm} 0`, ...TYPOGRAPHY.label }}>Tracking</p>
              {order.fulfillment?.tracking?.id && (
                <p style={{ margin: `0 0 ${SPACING.xs} 0`, ...TYPOGRAPHY.body, color: COLORS.textSecondary }}>
                  Tracking ID: {order.fulfillment?.tracking?.id}
                </p>
              )}
              {order.fulfillment?.tracking?.statusMessage && (
                <p style={{ margin: `0 0 ${SPACING.xs} 0`, ...TYPOGRAPHY.body, color: COLORS.textSecondary }}>
                  {order.fulfillment?.tracking?.statusMessage}
                </p>
              )}
              {order.fulfillment?.tracking?.url && (
                <a
                  href={order.fulfillment?.tracking?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: COLORS.info,
                    textDecoration: 'none',
                    fontWeight: TYPOGRAPHY.label.fontWeight,
                  }}
                >
                  Track Package →
                </a>
              )}
            </div>
          )}

          {/* Delivery Agent */}
          {order.fulfillment?.agent && (
            <div style={{ marginTop: SPACING.md, paddingTop: SPACING.md, borderTop: `1px solid ${COLORS.border}` }}>
              <p style={{ margin: `0 0 ${SPACING.sm} 0`, ...TYPOGRAPHY.label }}>Delivery Agent</p>
              {order.fulfillment?.agent?.name && (
                <p style={{ margin: `0 0 ${SPACING.xs} 0`, ...TYPOGRAPHY.body, color: COLORS.textSecondary }}>
                  Name: {order.fulfillment?.agent?.name}
                </p>
              )}
              {order.fulfillment?.agent?.phone && (
                <p style={{ margin: '0', ...TYPOGRAPHY.body, color: COLORS.textSecondary }}>
                  Phone: {order.fulfillment?.agent?.phone}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payment Info */}
      <div style={{ marginBottom: SPACING.xl }}>
        <h2 style={{ ...TYPOGRAPHY.h3, marginBottom: SPACING.md }}>Payment</h2>
        <div
          style={{
            ...CARD.base,
            backgroundColor: COLORS.bgPage,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
            <span style={{ color: COLORS.textSecondary }}>Method</span>
            <span style={{ ...TYPOGRAPHY.label, textTransform: 'capitalize' }}>
              {order.payment?.type}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
            <span style={{ color: COLORS.textSecondary }}>Amount</span>
            <span style={{ ...TYPOGRAPHY.label }}>
              {order.payment?.amount?.currency} {order.payment?.amount?.value}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: COLORS.textSecondary }}>Status</span>
            <span
              style={{
                ...TYPOGRAPHY.label,
                color:
                  order.payment?.status === 'completed'
                    ? COLORS.success
                    : order.payment?.status === 'failed'
                      ? COLORS.error
                      : COLORS.warning,
              }}
            >
              {order.payment?.status}
            </span>
          </div>
          {order.payment?.transactionId && (
            <p style={{ margin: `${SPACING.xs} 0 0 0`, ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary }}>
              Transaction ID: {order.payment?.transactionId}
            </p>
          )}
          {order.payment?.completedAt && (
            <p style={{ margin: `${SPACING.xs} 0 0 0`, ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary }}>
              Completed: {new Date(order.payment?.completedAt || '').toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Documents */}
      {order.documents && order.documents.length > 0 && (
        <div style={{ marginBottom: SPACING.xl }}>
          <h2 style={{ ...TYPOGRAPHY.h3, marginBottom: SPACING.md }}>Documents</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
            {order.documents.map((doc, index) => (
              <a
                key={index}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...CARD.base,
                  backgroundColor: COLORS.bgPage,
                  padding: SPACING.md,
                  textDecoration: 'none',
                  color: COLORS.info,
                  fontWeight: TYPOGRAPHY.label.fontWeight,
                  display: 'flex',
                  justifyContent: 'space-between',
                  border: `1px solid ${COLORS.border}`,
                  cursor: 'pointer',
                }}
              >
                <span>{doc.label || doc.type}</span>
                <span>↓</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Cancel Button (for cancellable orders) */}
      {canCancel && !order.cancellation && (
        <div
          style={{
            ...BADGE.error,
            padding: SPACING.xl,
          }}
        >
          <p style={{ margin: `0 0 ${SPACING.md} 0`, color: COLORS.error, ...TYPOGRAPHY.label }}>
            Need to cancel this order?
          </p>
          <button
            onClick={handleCancel}
            disabled={cancelling}
            style={{
              ...BUTTON.danger,
              cursor: cancelling ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Order'}
          </button>
        </div>
      )}
    </PageLayout>
  );
}
