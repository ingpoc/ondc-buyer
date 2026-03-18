import { DRAMS, SPACING } from '@portfolio-ui';

export interface RatingStarsProps {
  rating: number;
  maxRating?: number;
  size?: number;
}

export function RatingStars({ rating, maxRating = 5, size = 16 }: RatingStarsProps): JSX.Element {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = maxRating - fullStars - (hasHalfStar ? 1 : 0);

  const Star = ({ filled }: { filled: boolean }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      style={{ marginRight: SPACING.xs }}
    >
      <path
        d="M8 0l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"
        fill={filled ? DRAMS.orange : DRAMS.grayTrack}
      />
    </svg>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {[...Array(fullStars)].map((_, i) => (
        <Star key={`full-${i}`} filled />
      ))}
      {hasHalfStar && (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          style={{ marginRight: SPACING.xs }}
        >
          <defs>
            <linearGradient id="half-gradient">
              <stop offset="50%" stopColor={DRAMS.orange} />
              <stop offset="50%" stopColor={DRAMS.grayTrack} />
            </linearGradient>
          </defs>
          <path
            d="M8 0l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"
            fill="url(#half-gradient)"
          />
        </svg>
      )}
      {[...Array(emptyStars)].map((_, i) => (
        <Star key={`empty-${i}`} filled={false} />
      ))}
      <span style={{ marginLeft: SPACING.sm, fontSize: '14px' }}>{rating.toFixed(1)}</span>
    </div>
  );
}
