import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageSearch } from 'lucide-react';
import { COMMERCE_DEMO_MODE } from '../lib/commerceConfig';
import { listDemoOrders } from '../lib/localOrders';
import type { UCPOrder, UCPOrderStatus } from '../types';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../components/ui/empty';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

type StatusFilter = 'all' | 'pending' | 'active' | 'complete';

const isPendingStatus = (status: UCPOrderStatus): boolean =>
  status === 'created' || status === 'accepted';

const isActiveStatus = (status: UCPOrderStatus): boolean =>
  status === 'in_progress' ||
  status === 'packed' ||
  status === 'shipped' ||
  status === 'out_for_delivery';

const isCompleteStatus = (status: UCPOrderStatus): boolean => status === 'delivered';

function getStatusLabel(status: UCPOrderStatus): string {
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
}

function statusBadgeClass(status: UCPOrderStatus) {
  if (status === 'cancelled' || status === 'returned') return 'bg-rose-100 text-rose-800';
  if (status === 'delivered') return 'bg-lime-100 text-lime-900';
  if (isPendingStatus(status)) return 'bg-secondary text-secondary-foreground';
  if (isActiveStatus(status)) return 'bg-lime-50 text-lime-900';
  return 'bg-muted text-muted-foreground';
}

export function OrdersPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const orders: UCPOrder[] = COMMERCE_DEMO_MODE ? listDemoOrders() : [];

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return isPendingStatus(order.status);
    if (filter === 'active') return isActiveStatus(order.status);
    if (filter === 'complete') return isCompleteStatus(order.status);
    return true;
  });

  const filters: StatusFilter[] = ['all', 'pending', 'active', 'complete'];

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Orders
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Track buyer orders</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          Review pending, active, and completed orders from the buyer shell without losing trust or delivery context.
        </p>
      </section>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as StatusFilter)}>
        <TabsList className="h-auto w-full flex-wrap rounded-4xl">
          {filters.map((filterOption) => {
            const count = filterOption === 'all'
              ? orders.length
              : orders.filter((order) => {
                  if (filterOption === 'pending') return isPendingStatus(order.status);
                  if (filterOption === 'active') return isActiveStatus(order.status);
                  if (filterOption === 'complete') return isCompleteStatus(order.status);
                  return true;
                }).length;
            return (
              <TabsTrigger key={filterOption} value={filterOption} className="rounded-full">
                {filterOption} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {filteredOrders.length === 0 ? (
        <Empty className="border-border/70 bg-card/90">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageSearch className="size-5" />
            </EmptyMedia>
            <EmptyTitle>No orders in this lane</EmptyTitle>
            <EmptyDescription>
              Local demo orders will appear here after you move through checkout.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {filteredOrders.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => navigate(`/orders/${order.id}`)}
              className="text-left"
            >
              <Card className="h-full border-border/70 bg-card/90 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg">
                <CardHeader className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Order #{order.id}
                      </div>
                      <CardTitle className="text-xl">
                        {new Date(order.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </CardTitle>
                    </div>
                    <Badge variant="secondary" className={`rounded-full ${statusBadgeClass(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    {order.items.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          {item.quantity}× {item.name}
                        </span>
                        <span className="font-medium">
                          {item.price.currency} {item.price.value}
                        </span>
                      </div>
                    ))}
                    {order.items.length > 3 ? (
                      <div className="text-sm text-muted-foreground">
                        +{order.items.length - 3} more items
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                    <div className="text-sm text-muted-foreground">
                      {order.provider?.name || 'Unknown seller'}
                    </div>
                    <div className="text-lg font-semibold">
                      {order.quote?.total?.currency} {order.quote?.total?.value ?? order.quote?.total?.amount}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
