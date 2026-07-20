import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  it('gives the query field and submit action distinct accessible names', () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
      target: { value: 'rice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search groceries' }));

    expect(onSearch).toHaveBeenCalledWith('grocery', 'rice');
    expect(screen.getByRole('button', { name: 'Search groceries' })).toHaveTextContent(
      'Search groceries',
    );
  });

  it('submits the current query when Enter is pressed in the search field', () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);

    const query = screen.getByRole('textbox', { name: 'Search' });
    fireEvent.change(query, { target: { value: 'atta' } });
    fireEvent.keyDown(query, { key: 'Enter', code: 'Enter' });

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('grocery', 'atta');
  });
});
