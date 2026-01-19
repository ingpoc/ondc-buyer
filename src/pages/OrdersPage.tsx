import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UCPOrder, UCPOrderStatus } from '../types';
import { PageLayout, PageHeader, DRAMS, SPACING, TYPOGRAPHY, CARD, PILL_BUTTON, RADIUS, TRANSITIONS, BADGE, GRID, DramsTabGroup, DramsEmptyState, type DramsTabOption } from '@ondc-sdk/shared/design-system';

type StatusFilter = 'all' | 'pending' | 'active' | 'complete';

// Status grouping helpers
const isPendingStatus = (status: UCPOrderStatus): boolean =>
  status === 'created' || status === 'accepted';

const isActiveStatus = (status: UCPOrderStatus): boolean =>
  status === 'in_progress' ||
  status === 'packed' ||
  status === 'shipped' ||
  status === 'out_for_delivery';

const isCompleteStatus = (status: UCPOrderStatus): boolean =>
  status === 'delivered';

// Mock orders - to be replaced with API call in SDK-BUYER-ORDERS-003
const mockOrders: UCPOrder[] = [];

const ORDER_CARD_STYLE = {
  ...CARD.base,
  cursor: 'pointer',
  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
};

const ORDER_CARD_HOVER_STYLE = {
  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
  transform: 'translateY(-2px)',
};

export function OrdersPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<StatusFilter>('all');

  // Filter orders based on selected status
  const filteredOrders = mockOrders.filter((order) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return isPendingStatus(order.status);
    if (filter === 'active') return isActiveStatus(order.status);
    if (filter === 'complete') return isCompleteStatus(order.status);
    return true;
  });

  const getStatusLabel = (status: UCPOrderStatus): string => {
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

  const getStatusBadgeVariant = (status: UCPOrderStatus): keyof typeof BADGE => {
    if (status === 'cancelled' || status === 'returned') return 'error';
    if (status === 'delivered') return 'success';
    if (isPendingStatus(status)) return 'info';
    if (isActiveStatus(status)) return 'warning';
    return 'success';
  };

  const handleOrderClick = (orderId: string) => {
    navigate(`/orders/${orderId}`);
  };

  // Build tab options with counts
  const tabOptions: DramsTabOption[] = (['all', 'pending', 'active', 'complete'] as StatusFilter[]).map(
    (filterOption) => {
      const count = filterOption === 'all'
        ? mockOrders.length
        : mockOrders.filter((o) => {
            if (filterOption === 'pending') return isPendingStatus(o.status);
            if (filterOption === 'active') return isActiveStatus(o.status);
            if (filterOption === 'complete') return isCompleteStatus(o.status);
            return true;
          }).length;

      return {
        value: filterOption,
        label: filterOption,
        count,
      };
    }
  );

  return (
    <PageLayout title="My Orders">
      <DramsTabGroup
        options={tabOptions}
        value={filter}
        onChange={(value) => setFilter(value as StatusFilter)}
        style={{ marginBottom: SPACING['2xl'] }}
      />

      {filteredOrders.length === 0 ? (
        <DramsEmptyState
          icon="📦"
          title={filter === 'all' ? "You haven't placed any orders yet" : `No ${filter} orders`}
          message={filter === 'all' ? 'Start shopping to see your orders here' : undefined}
          actionLabel={filter === 'all' ? 'Start Shopping' : undefined}
          onAction={filter === 'all' ? () => navigate('/search') : undefined}
        />
      ) : (
        <div style={GRID.autoFill}>
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => handleOrderClick(order.id)}
              style={ORDER_CARD_STYLE}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, ORDER_CARD_HOVER_STYLE);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = CARD.base.boxShadow || 'none';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ marginBottom: SPACING.lg, paddingBottom: SPACING.lg, borderBottom: `1px solid ${DRAMS.grayTrack}` }}>
                <div style={{ ...TYPOGRAPHY.bodySmall, color: DRAMS.textLight, marginBottom: SPACING.xs }}>
                  Order #{order.id}
                </div>
                <div style={{ ...TYPOGRAPHY.bodySmall, color: DRAMS.textLight }}>
                  {new Date(order.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </div>

              <div style={{ marginBottom: SPACING.lg }}>
                {order.items.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    style={{ display: 'flex', justifyContent: 'space-between', marginBottom: SPACING.sm, ...TYPOGRAPHY.body }}
                  >
                    <span style={{ color: DRAMS.textDark }}>
                      {item.quantity}x {item.name}
                    </span>
                    <span style={{ color: DRAMS.textLight }}>
                      {item.price.currency} {item.price.value}
                    </span>
                  </div>
                ))}
                {order.items.length > 3 && (
                  <div style={{ ...TYPOGRAPHY.bodySmall, color: DRAMS.textLight, marginTop: SPACING.sm }}>
                    +{order.items.length - 3} more items
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: SPACING.md, borderTop: `1px solid ${DRAMS.grayTrack}` }}>
                <div style={{ ...TYPOGRAPHY.bodySmall, color: DRAMS.textLight }}>
                  {order.provider?.name}
                </div>
                <div style={{ ...TYPOGRAPHY.h4, color: DRAMS.textDark }}>
                  {order.quote?.total?.currency} {order.quote?.total?.value ?? order.quote?.total?.amount}
                </div>
              </div>

              <div style={{
                ...BADGE.base,
                ...BADGE[getStatusBadgeVariant(order.status)],
                marginTop: SPACING.md,
              }}>
                {getStatusLabel(order.status)}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
