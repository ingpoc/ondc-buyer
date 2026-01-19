import type { UCPQuote } from '../types';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, DRAMS } from '@ondc-sdk/shared/design-system';

const BREAKUP_TITLES: Record<string, string> = {
  item: 'Items',
  delivery: 'Delivery',
  tax: 'Tax',
  discount: 'Discount',
  fee: 'Fees',
  other: 'Other',
};

const CONTAINER_STYLE = {
  backgroundColor: 'white',
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.lg,
  padding: SPACING.xl,
};

// DRAMS: Use warning colors from design system instead of hard-coded values
const VALIDITY_WARNING_STYLE = {
  padding: `${SPACING.md} ${SPACING.lg}`,
  backgroundColor: 'rgb(253, 243, 199)', // Light amber background
  border: `1px solid rgb(217, 119, 6)`, // Amber border
  borderRadius: RADIUS.sm,
  color: 'rgb(120, 53, 15)', // Dark amber text
  fontSize: TYPOGRAPHY.bodySmall.fontSize,
  marginBottom: SPACING.lg,
};

const GROUP_HEADER_STYLE = {
  fontWeight: TYPOGRAPHY.label.fontWeight,
  fontSize: TYPOGRAPHY.bodySmall.fontSize,
  color: COLORS.textSecondary,
  marginBottom: SPACING.xs,
  textTransform: 'uppercase' as const,
};

const BREAKUP_ITEM_STYLE = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: `${SPACING.xs} 0`,
  borderBottom: `1px solid ${COLORS.borderSubtle}`,
  fontSize: TYPOGRAPHY.bodySmall.fontSize,
};

const TOTALS_SECTION_STYLE = {
  borderTop: `2px solid ${COLORS.border}`,
  paddingTop: SPACING.lg,
  marginTop: SPACING.lg,
};

const TOTAL_ROW_STYLE = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: SPACING.md,
  fontSize: TYPOGRAPHY.bodySmall.fontSize,
};

const FINAL_TOTAL_STYLE = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: SPACING.md,
  borderTop: `2px solid ${COLORS.border}`,
  fontSize: TYPOGRAPHY.h4.fontSize,
  fontWeight: TYPOGRAPHY.h4.fontWeight,
};

const SAVINGS_BADGE_STYLE = {
  marginTop: SPACING.md,
  padding: `${SPACING.md} ${SPACING.lg}`,
  backgroundColor: COLORS.bgSubtle,
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.sm,
  color: COLORS.textSecondary,
  fontSize: TYPOGRAPHY.bodySmall.fontSize,
  textAlign: 'center' as const,
  fontWeight: TYPOGRAPHY.label.fontWeight,
};

export interface QuoteDisplayProps {
  quote: UCPQuote;
  currency: string;
}

export function QuoteDisplay({ quote, currency }: QuoteDisplayProps): JSX.Element {
  function formatPrice(price?: { value?: string | number; amount?: string | number }): string {
    const value = price?.value ?? price?.amount ?? '0';
    return typeof value === 'number' ? value.toFixed(2) : String(value);
  }

  function getBreakupTitle(type: string): string {
    return BREAKUP_TITLES[type] || type;
  }

  // Group breakup items by type
  const groupedBreakup = quote.breakup?.reduce((acc, item) => {
    const type = item.type || 'other';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(item);
    return acc;
  }, {} as Record<string, typeof quote.breakup>) ?? {};

  const discountValue = quote.discount ? parseFloat(formatPrice(quote.discount)) : 0;
  const hasDiscount = discountValue > 0;

  return (
    <div style={CONTAINER_STYLE}>
      <h2 style={{ marginTop: 0, marginBottom: '16px' }}>Quote Details</h2>

      {quote.ttl && (
        <div style={VALIDITY_WARNING_STYLE}>
          ⏱ Quote valid for {parseDuration(quote.ttl)}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        {Object.entries(groupedBreakup).map(([type, items]) => (
          <div key={type} style={{ marginBottom: '12px' }}>
            <div style={GROUP_HEADER_STYLE}>{getBreakupTitle(type)}</div>
            {items.map((item, index) => (
              <div key={index} style={BREAKUP_ITEM_STYLE}>
                <span>
                  {item.quantity && item.quantity > 1
                    ? `${item.title} × ${item.quantity}`
                    : item.title}
                </span>
                <span style={{ fontWeight: '500' }}>
                  {currency} {formatPrice(item.price)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={TOTALS_SECTION_STYLE}>
        {quote.subtotal && (
          <div style={TOTAL_ROW_STYLE}>
            <span style={{ color: COLORS.textSecondary }}>Subtotal</span>
            <span>{currency} {formatPrice(quote.subtotal)}</span>
          </div>
        )}

        {quote.deliveryCost && (
          <div style={TOTAL_ROW_STYLE}>
            <span style={{ color: COLORS.textSecondary }}>Delivery</span>
            <span>{currency} {formatPrice(quote.deliveryCost)}</span>
          </div>
        )}

        {quote.tax && (
          <div style={TOTAL_ROW_STYLE}>
            <span style={{ color: COLORS.textSecondary }}>Tax</span>
            <span>{currency} {formatPrice(quote.tax)}</span>
          </div>
        )}

        {hasDiscount && (
          <div style={TOTAL_ROW_STYLE}>
            <span style={{ color: COLORS.success }}>Discount</span>
            <span style={{ color: COLORS.success }}>
              -{currency} {formatPrice(quote.discount)}
            </span>
          </div>
        )}

        <div style={FINAL_TOTAL_STYLE}>
          <span>Total</span>
          <span style={{ color: COLORS.success, fontSize: TYPOGRAPHY.bodySmall.fontSize }}>
            {currency} {formatPrice(quote.total)}
          </span>
        </div>
      </div>

      {hasDiscount && (
        <div style={SAVINGS_BADGE_STYLE}>
          You save {currency} {formatPrice(quote.discount)} on this order!
        </div>
      )}
    </div>
  );
}

/**
 * Parse ISO 8601 duration to human readable format
 * Example: PT10M -> 10 minutes, PT1H -> 1 hour
 */
function parseDuration(duration: string): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return duration;

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;

  if (hours > 0 && minutes > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  return duration;
}
