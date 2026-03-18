import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi, useCart } from '../hooks';
import { RatingStars } from '../components';
import { PageLayout, DRAMS, SPACING, TYPOGRAPHY, BUTTON, CARD, COLORS, GRID, DramsFlipCard, FlipCardFront, FlipCardBack, DramsAddButton } from '@portfolio-ui';
import type { UCPItem } from '../types';

const BACK_BUTTON_STYLE = {
  ...BUTTON.secondary,
  marginBottom: SPACING.xl,
};

const IMAGE_SECTION_STYLE = {
  position: 'sticky' as const,
  top: SPACING.xl,
};

const IMAGE_CARD_STYLE = {
  ...CARD.base,
  padding: 0,
  overflow: 'hidden',
};

const IMAGE_STYLE = {
  width: '100%',
  height: '400px',
  objectFit: 'cover' as const,
  backgroundColor: DRAMS.grayTrack,
};

const DETAILS_SECTION_STYLE = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: SPACING.xl,
};

const TITLE_STYLE = {
  ...TYPOGRAPHY.h1,
  color: DRAMS.textDark,
  margin: 0,
};

const DESCRIPTION_STYLE = {
  ...TYPOGRAPHY.body,
  lineHeight: 1.6,
  color: DRAMS.textLight,
};

const PRICE_SECTION_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.md,
  marginBottom: SPACING.md,
};

const PRICE_STYLE = {
  ...TYPOGRAPHY.h2,
  color: DRAMS.orange,
};

const RATING_STYLE = {
  marginBottom: SPACING.md,
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
};

const MESSAGE_STYLE = {
  marginLeft: SPACING.md,
  ...TYPOGRAPHY.bodySmall,
};

const SPECS_CARD_STYLE = {
  ...CARD.base,
};

export function ProductDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error, execute } = useApi<UCPItem>(`/api/catalog/products/${id}`);
  const { addToCart } = useCart();
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState('');

  useEffect(() => {
    execute();
  }, [execute]);

  async function handleAddToCart(): Promise<void> {
    if (!data) return;

    setAddingToCart(true);
    setCartMessage('');

    try {
      await addToCart(data as any);
      setCartMessage('Added to cart!');
      setTimeout(() => setCartMessage(''), 2000);
    } catch {
      setCartMessage('Failed to add to cart');
      setTimeout(() => setCartMessage(''), 2000);
    } finally {
      setAddingToCart(false);
    }
  }

  if (loading) {
    return (
      <PageLayout>
        <div style={LOADING_STYLE}>Loading product details...</div>
      </PageLayout>
    );
  }

  if (error || !data) {
    return (
      <PageLayout>
        <div style={ERROR_STYLE}>
          <p style={{ margin: 0, fontWeight: TYPOGRAPHY.label.fontWeight }}>Error</p>
          <p style={{ margin: `${SPACING.xs} 0 ${SPACING.md} 0` }}>{error || 'Product not found'}</p>
          <button
            onClick={() => navigate(-1)}
            style={BACK_BUTTON_STYLE}
          >
            Go Back
          </button>
        </div>
      </PageLayout>
    );
  }

  const messageColor = cartMessage.includes('Failed') ? COLORS.error : DRAMS.orange;

  // Build stats for flip card front
  const stats = [
    { label: 'Category', value: data.category || 'General' },
    { label: 'Rating', value: data.rating ? `${data.rating.value}/5` : 'N/A' },
  ];

  // Build specs for flip card back
  const specs = [
    { label: 'Category', value: data.category || 'General' },
    { label: 'Seller', value: data.provider?.name || 'Unknown' },
    { label: 'Stock', value: 'In Stock' },
  ];

  return (
    <PageLayout>
      <button onClick={() => navigate(-1)} style={BACK_BUTTON_STYLE}>
        ← Back
      </button>

      <div style={GRID.twoColumns}>
        {/* Left: Product Image */}
        <div style={IMAGE_SECTION_STYLE}>
          <div style={IMAGE_CARD_STYLE}>
            {data.images?.[0] ? (
              <img src={data.images[0].url} alt={data.name} style={IMAGE_STYLE} />
            ) : (
              <div style={{ ...IMAGE_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: `radial-gradient(50% 50% at 30% 30%, ${DRAMS.orangeHighlight} 0%, ${DRAMS.orange} 100%)`,
                  borderRadius: '50%',
                  boxShadow: `rgba(232, 61, 23, 0.4) 0px 0px 2px -1px inset, 0 4px 12px ${DRAMS.orange}33`,
                }} />
              </div>
            )}
          </div>
        </div>

        {/* Right: Product Details */}
        <div style={DETAILS_SECTION_STYLE}>
          <h1 style={TITLE_STYLE}>{data.name}</h1>

          {data.description && (
            <p style={DESCRIPTION_STYLE}>{data.description}</p>
          )}

          <div style={PRICE_SECTION_STYLE}>
            <span style={PRICE_STYLE}>
              {data.price?.currency} {data.price?.value ?? data.price?.amount}
            </span>
            {data.rating && (
              <div style={RATING_STYLE}>
                <RatingStars rating={data.rating.value ?? 0} />
              </div>
            )}
          </div>

          {/* Flip Card for Specs */}
          <div style={SPECS_CARD_STYLE}>
            <DramsFlipCard
              height={240}
              front={
                <FlipCardFront
                  title="Product Details"
                  stats={stats}
                  hint="Click for specifications"
                />
              }
              back={
                <FlipCardBack
                  specs={specs}
                />
              }
            />
          </div>

          {/* Add to Cart Button */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <DramsAddButton
              onClick={handleAddToCart}
              disabled={addingToCart}
              loading={addingToCart}
              size="lg"
              fullWidth
            >
              {addingToCart ? 'Adding...' : 'Add to Cart'}
            </DramsAddButton>
            {cartMessage && (
              <span style={{ ...MESSAGE_STYLE, color: messageColor }}>
                {cartMessage}
              </span>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
