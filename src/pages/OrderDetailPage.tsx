import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MapPin, Truck } from 'lucide-react';
import { COMMERCE_DEMO_MODE } from '../lib/commerceConfig';
import { cancelDemoOrder, getDemoOrder } from '../lib/localOrders';
import { createLocalSupportCase, listSupportCases } from '../lib/localSupportCases';
import type { UCPFulfillmentStatus, UCPOrder, UCPOrderStatus } from '../types';
import type { BuyerSupportCase } from '../types/agent';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Spinner } from '../components/ui/spinner';

const CANCELLABLE_STATUSES: UCPOrderStatus[] = ['created', 'accepted', 'in_progress'];
const isCancellable = (status: UCPOrderStatus): boolean => CANCELLABLE_STATUSES.includes(status);

const fetchOrder = async (orderId: string): Promise<UCPOrder | null> => {
  if (COMMERCE_DEMO_MODE) {
    return getDemoOrder(orderId);
  }
  void orderId;
  return null;
};

function getOrderStatusLabel(status: UCPOrderStatus): string {
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

function getFulfillmentStatusLabel(status: UCPFulfillmentStatus): string {
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
}

function statusClass(status: UCPOrderStatus) {
  if (status === 'cancelled' || status === 'returned') return 'bg-rose-100 text-rose-800';
  if (status === 'delivered') return 'bg-lime-100 text-lime-900';
  if (status === 'created' || status === 'accepted') return 'bg-secondary text-secondary-foreground';
  return 'bg-lime-50 text-lime-900';
}

function formatPrice(currency: string, value: string | undefined, quantity = 1) {
  const numeric = value ? parseFloat(value) : 0;
  return `${currency} ${(numeric * quantity).toFixed(2)}`;
}

export function OrderDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<UCPOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [supportCases, setSupportCases] = useState<BuyerSupportCase[]>([]);
  const [issueType, setIssueType] = useState<BuyerSupportCase['issue_type']>('fulfillment');
  const [issueDescription, setIssueDescription] = useState('');

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
          setSupportCases(listSupportCases(data.id));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };

    void loadOrder();
  }, [id]);

  async function handleCancel() {
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
  }

  function handleCreateIssue() {
    if (!order || !issueDescription.trim()) {
      return;
    }

    const supportCase = createLocalSupportCase({
      order_id: order.id,
      issue_type: issueType,
      description: issueDescription.trim(),
      evidence_links: [],
    });

    setSupportCases((current) => [supportCase, ...current]);
    setIssueDescription('');
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <Spinner className="size-6" />
        <div className="text-sm text-muted-foreground">Loading order details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-md">
        <CardContent className="space-y-4 py-8 text-center">
          <div className="text-lg font-semibold">Order detail unavailable</div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate('/orders')}>
            Back to orders
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!order) {
    return (
      <div className="text-sm text-muted-foreground">Order not found.</div>
    );
  }

  const canCancel = isCancellable(order.status);

  return (
    <div className="space-y-8">
      <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate('/orders')}>
        <ChevronLeft className="size-4" />
        Back to orders
      </Button>

      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Order detail
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Order #{order.id}</h1>
          <p className="text-sm text-muted-foreground">
            Created on{' '}
            {new Date(order.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className={`rounded-full ${statusClass(order.status)}`}>
            {getOrderStatusLabel(order.status)}
          </Badge>
          {canCancel ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => void handleCancel()}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Cancel order'}
            </Button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="text-xl">Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-background/70 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">Quantity: {item.quantity}</div>
                    {item.customizations ? (
                      <div className="text-sm text-muted-foreground">
                        {Object.entries(item.customizations)
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(' | ')}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-sm font-medium">
                    {formatPrice(item.price.currency, item.price.value ?? String(item.price.amount ?? 0), item.quantity)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="text-xl">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {order.quote?.breakup?.map((item, index) => (
                <div key={`${item.title}-${index}`} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{item.title}</span>
                  <span>{item.price.currency} {item.price.value ?? item.price.amount}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4 text-base font-semibold">
                <span>Total</span>
                <span>
                  {order.quote?.total?.currency} {order.quote?.total?.value ?? order.quote?.total?.amount}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="text-xl">Support & grievance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Issue type</span>
                  <select
                    value={issueType}
                    onChange={(event) =>
                      setIssueType(event.target.value as BuyerSupportCase['issue_type'])
                    }
                    className="w-full rounded-2xl border border-border/70 bg-background px-3 py-2 text-sm"
                  >
                    <option value="fulfillment">Fulfillment</option>
                    <option value="cancellation">Cancellation</option>
                    <option value="post_delivery">Post delivery</option>
                    <option value="payment">Payment</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Describe the issue</span>
                  <textarea
                    value={issueDescription}
                    onChange={(event) => setIssueDescription(event.target.value)}
                    placeholder="Describe the problem for this order."
                    className="min-h-28 w-full rounded-2xl border border-border/70 bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={handleCreateIssue}
                  disabled={!issueDescription.trim()}
                >
                  Create support case
                </Button>
              </div>

              {supportCases.length > 0 ? (
                <div className="space-y-3">
                  {supportCases.map((supportCase) => (
                    <div
                      key={supportCase.case_id}
                      className="rounded-3xl border border-border/70 bg-background/70 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold">{supportCase.network_case_id}</div>
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            {supportCase.issue_type} ·{' '}
                            {new Date(supportCase.created_at).toLocaleString('en-US')}
                          </div>
                        </div>
                        <Badge variant="secondary" className="rounded-full">
                          {supportCase.status}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {supportCase.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No support cases yet for this order.
                </p>
              )}
            </CardContent>
          </Card>

          {order.documents?.length ? (
            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle className="text-xl">Documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.documents.map((document, index) => (
                  <a
                    key={`${document.url}-${index}`}
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-3xl border border-border/70 bg-background/70 px-4 py-4 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span>{document.label || document.type || 'Document'}</span>
                    <span className="text-muted-foreground">Open</span>
                  </a>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Truck className="size-5" />
                Fulfillment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">
                  {order.fulfillment?.status
                    ? getFulfillmentStatusLabel(order.fulfillment.status)
                    : 'Pending'}
                </span>
              </div>
              {order.fulfillment?.providerName ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Provider</span>
                  <span>{order.fulfillment.providerName}</span>
                </div>
              ) : null}
              {order.fulfillment?.tracking?.statusMessage ? (
                <p className="rounded-3xl bg-muted/70 px-4 py-3 text-muted-foreground">
                  {order.fulfillment.tracking.statusMessage}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <MapPin className="size-5" />
                Delivery address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div>{order.deliveryAddress?.name}</div>
              <div>{order.deliveryAddress?.line1 || order.deliveryAddress?.street}</div>
              <div>
                {[order.deliveryAddress?.city, order.deliveryAddress?.state, order.deliveryAddress?.postalCode || order.deliveryAddress?.pincode]
                  .filter(Boolean)
                  .join(', ')}
              </div>
              <div>{order.deliveryAddress?.country || 'IND'}</div>
            </CardContent>
          </Card>

          {order.cancellation ? (
            <Card className="border-rose-200 bg-rose-50 text-rose-900 shadow-none">
              <CardHeader>
                <CardTitle className="text-xl">Cancellation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>Cancelled by: {order.cancellation.cancelledBy}</div>
                {order.cancellation.cancelledAt ? (
                  <div>
                    Cancelled at:{' '}
                    {new Date(order.cancellation.cancelledAt).toLocaleString('en-US')}
                  </div>
                ) : null}
                {order.cancellation.reason ? <div>{order.cancellation.reason}</div> : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  );
}
