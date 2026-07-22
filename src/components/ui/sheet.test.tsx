import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Sheet, SheetContent, SheetDescription, SheetTitle } from './sheet';

describe('Sheet ref contract', () => {
  it('opens without React function-component ref errors', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const view = render(
      <Sheet open onOpenChange={() => undefined}>
        <SheetContent>
          <SheetTitle>Buyer navigation</SheetTitle>
          <SheetDescription>Buyer navigation controls.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );

    expect(consoleError.mock.calls.flat().join(' ')).not.toContain(
      'Function components cannot be given refs',
    );

    view.unmount();
    consoleError.mockRestore();
  });
});
