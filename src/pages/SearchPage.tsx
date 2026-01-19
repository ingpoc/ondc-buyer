import { useNavigate } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';
import { PageLayout, TYPOGRAPHY, DRAMS, SPACING, APP, LAYOUT } from '@ondc-sdk/shared/design-system';

const HERO_STYLE = {
  ...LAYOUT.centered,
  textAlign: 'center' as const,
  padding: `${SPACING['3xl']} ${SPACING.xl}`,
};

export function SearchPage(): JSX.Element {
  const navigate = useNavigate();

  function handleSearch(category: string, query: string): void {
    navigate(`/results?category=${category}&q=${encodeURIComponent(query)}`);
  }

  return (
    <PageLayout>
      <div style={HERO_STYLE}>
        <h1 style={TYPOGRAPHY.h1}>
          Find What You Need
        </h1>
        <p style={{ ...TYPOGRAPHY.body, color: DRAMS.textLight, margin: `0 0 ${SPACING.xl} 0` }}>
          Search across thousands of products from verified sellers. Get the best prices and fastest delivery.
        </p>
        <SearchBar onSearch={handleSearch} />
      </div>
    </PageLayout>
  );
}
