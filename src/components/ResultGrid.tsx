import { DramsProductCard, DramsEmptyState, DramsSpinner } from '@portfolio-ui';
import type { UCPItem } from '../types';

export interface ResultGridProps {
  items: UCPItem[];
  onItemClick?: (item: UCPItem) => void;
  onAddToCart?: (item: UCPItem) => void;
  loading?: boolean;
}

export function ResultGrid({ items, onItemClick, onAddToCart, loading }: ResultGridProps): JSX.Element {
  if (loading) {
    return <DramsSpinner size="lg" message="Searching for products..." />;
  }

  if (items.length === 0) {
    return (
      <DramsEmptyState
        icon="🔍"
        title="No results found"
        message="Try adjusting your search terms or filters to find what you're looking for."
      />
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <DramsProductCard
          key={item.id}
          name={item.name ?? item.descriptor?.name ?? 'Product'}
          category={item.category}
          price={`${item.price?.currency || '₹'} ${item.price?.value ?? item.price?.amount ?? '0'}`}
          image={item.images?.[0]?.url ?? undefined}
          badge={item.rating?.value ? `${item.rating.value.toFixed(1)}★` : item._provider}
          onClick={() => onItemClick?.(item)}
          onAdd={onAddToCart ? () => onAddToCart(item) : undefined}
        />
      ))}
    </div>
  );
}
