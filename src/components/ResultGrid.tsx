import { DramsProductCard, DramsEmptyState, DramsSpinner } from '@ondc-sdk/shared/design-system';
import type { UCPItem } from '../types';
import { SPACING } from '@ondc-sdk/shared/design-system';

const GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
  gap: SPACING.xl,
};

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
        message="Try adjusting your search terms or filters to find what you're looking for"
      />
    );
  }

  return (
    <div style={GRID_STYLE}>
      {items.map((item) => (
        <DramsProductCard
          key={item.id}
          name={item.name ?? 'Product'}
          category={item.category}
          price={`${item.price?.currency || '₹'} ${item.price?.value ?? item.price?.amount ?? '0'}`}
          image={item.images?.[0]?.url ?? undefined}
          onClick={() => onItemClick?.(item)}
          onAdd={onAddToCart ? () => onAddToCart(item) : undefined}
        />
      ))}
    </div>
  );
}
