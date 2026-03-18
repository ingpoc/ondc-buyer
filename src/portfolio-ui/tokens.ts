import type { CSSProperties } from 'react';

export const COLORS = {
  bgPage: 'var(--ui-bg)',
  bgCard: 'var(--ui-bg-elevated)',
  bgSubtle: 'var(--ui-bg-subtle)',
  bgHover: '#e6e1d8',
  textPrimary: 'var(--ui-text)',
  textSecondary: 'var(--ui-text-secondary)',
  textMuted: 'var(--ui-text-muted)',
  textDisabled: '#b0a89b',
  border: 'var(--ui-border)',
  borderSubtle: 'rgba(16, 16, 16, 0.05)',
  success: 'var(--ui-success)',
  warning: 'var(--ui-warning)',
  error: 'var(--ui-error)',
  info: 'var(--ui-info)',
} as const;

export const DRAMS = {
  orange: 'var(--ui-primary)',
  orangeHighlight: '#ffb58d',
  grayTrack: 'var(--ui-bg-subtle)',
  grayHover: '#e6e1d8',
  textDark: 'var(--ui-text)',
  textLight: 'var(--ui-text-muted)',
  fontFamily: 'var(--ui-font-sans)',
} as const;

export const TRANSITIONS = {
  standard: 'all 180ms ease',
  hover: 'all 150ms ease',
  bounce: 'all 220ms cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
  '4xl': '64px',
} as const;

export const TYPOGRAPHY = {
  h1: { fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.05 },
  h2: { fontSize: 'clamp(1.65rem, 3vw, 2.4rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 },
  h3: { fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 },
  h4: { fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.3 },
  body: { fontSize: '0.95rem', fontWeight: 500, lineHeight: 1.6 },
  bodySmall: { fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.5 },
  label: { fontSize: '0.78rem', fontWeight: 700, lineHeight: 1.4, textTransform: 'uppercase' as const, letterSpacing: '0.08em' },
} as const;

export const RADIUS = {
  sm: '12px',
  md: '16px',
  lg: '24px',
  card: '24px',
  pill: '999px',
  circle: '999px',
} as const;

export const BUTTON = {
  primary: {
    borderRadius: RADIUS.pill,
    padding: `${SPACING.md} ${SPACING.xl}`,
    backgroundColor: DRAMS.orange,
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    boxShadow: '0 10px 24px rgba(234, 106, 42, 0.24)',
  },
  secondary: {
    borderRadius: RADIUS.pill,
    padding: `${SPACING.md} ${SPACING.xl}`,
    backgroundColor: COLORS.bgCard,
    color: COLORS.textPrimary,
    border: `1px solid ${COLORS.border}`,
    cursor: 'pointer',
    fontWeight: 700,
  },
  ghost: {
    borderRadius: RADIUS.pill,
    padding: `${SPACING.md} ${SPACING.xl}`,
    backgroundColor: 'transparent',
    color: COLORS.textPrimary,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
  },
  danger: {
    borderRadius: RADIUS.pill,
    padding: `${SPACING.md} ${SPACING.xl}`,
    backgroundColor: COLORS.error,
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    boxShadow: '0 10px 24px rgba(194, 65, 12, 0.22)',
  },
} as const;

export const PILL_BUTTON = {
  orange: BUTTON.primary,
  gray: {
    ...BUTTON.secondary,
    backgroundColor: COLORS.bgSubtle,
  },
} as const;

export const CARD = {
  base: {
    backgroundColor: COLORS.bgCard,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.card,
    padding: SPACING.xl,
    boxShadow: 'var(--ui-shadow-sm)',
  } satisfies CSSProperties,
} as const;

export const BADGE = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: RADIUS.pill,
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
  } satisfies CSSProperties,
  success: { backgroundColor: 'rgba(19, 121, 91, 0.12)', color: COLORS.success },
  warning: { backgroundColor: 'rgba(180, 83, 9, 0.12)', color: COLORS.warning },
  error: { backgroundColor: 'rgba(194, 65, 12, 0.12)', color: COLORS.error },
  info: { backgroundColor: 'rgba(29, 78, 216, 0.12)', color: COLORS.info },
} as const;

export const APP = {
  headerHeight: '72px',
  maxWidth: '1440px',
  contentMaxWidth: '1280px',
} as const;

export const GRID = {
  container: {
    width: '100%',
    maxWidth: APP.contentMaxWidth,
    margin: '0 auto',
    paddingLeft: SPACING.xl,
    paddingRight: SPACING.xl,
  },
  containerWide: {
    width: '100%',
    maxWidth: APP.maxWidth,
    margin: '0 auto',
    paddingLeft: SPACING.xl,
    paddingRight: SPACING.xl,
  },
  gap: {
    xs: SPACING.xs,
    sm: SPACING.sm,
    md: SPACING.md,
    lg: SPACING.lg,
    xl: SPACING.xl,
    '2xl': SPACING['2xl'],
    '3xl': SPACING['3xl'],
  },
  twoColumns: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 1fr)',
    gap: SPACING.xl,
  } satisfies CSSProperties,
  twoColumnsWide: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.5fr) minmax(300px, 1fr)',
    gap: SPACING.xl,
  } satisfies CSSProperties,
  threeColumns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: SPACING.lg,
  } satisfies CSSProperties,
  autoFill: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: SPACING.lg,
  } satisfies CSSProperties,
} as const;

export const LAYOUT = {
  page: {
    minHeight: '100%',
  } satisfies CSSProperties,
  pageGray: {
    minHeight: '100%',
    background: COLORS.bgPage,
  } satisfies CSSProperties,
  centered: {
    width: '100%',
    maxWidth: '72rem',
    margin: '0 auto',
  } satisfies CSSProperties,
  gridFilters: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 280px) minmax(0, 1fr)',
    gap: SPACING.xl,
    alignItems: 'start',
  } satisfies CSSProperties,
} as const;

export const disabled: CSSProperties = {
  opacity: 0.55,
  cursor: 'not-allowed',
};

export const DRAMS_CARD = CARD;

export type SpacingValue = keyof typeof SPACING;
export type TypographyKey = keyof typeof TYPOGRAPHY;
export type RadiusKey = keyof typeof RADIUS;
