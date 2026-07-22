import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SamanthaOrb } from './SamanthaOrb';

vi.mock('../hooks', () => ({
  useSubject: () => ({ subjectId: 'principal:demo:test', walletAddress: null }),
  useCart: () => ({
    session: { id: 'session-1', items: [] },
    subtotal: 0,
    addToCart: vi.fn(),
    clearCart: vi.fn(),
    removeFromCart: vi.fn(),
    updateQuantity: vi.fn(),
    refreshCart: vi.fn(),
  }),
}));

describe('Buyer Samantha dialog', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: { configured: false } }),
      })),
    );
  });

  it('opens as a named dialog, focuses text, explains mic state, and closes with Escape', async () => {
    render(
      <MemoryRouter>
        <SamanthaOrb />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: 'Open Samantha' });
    fireEvent.click(trigger);

    expect(await screen.findByRole('dialog', { name: 'Samantha' })).toBeVisible();
    const input = screen.getByRole('textbox', { name: 'Ask Samantha' });
    await waitFor(() => expect(input).toHaveFocus());
    expect(screen.getByTestId('samantha-mic-status')).toHaveTextContent(
      'Microphone off. Text remains available.',
    );

    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Samantha' })).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open Samantha' })).toHaveFocus());
  });
});
