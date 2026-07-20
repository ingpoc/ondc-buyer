import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Buyer product copy', () => {
  it('uses customer-facing ONDC language and removes environment qualifiers', () => {
    const usecase = source('public/usecase.html');
    const manifest = source('package.json');
    const entrypoint = source('src/main.tsx');
    const buyerUi = [source('src/App.tsx'), source('src/pages/SearchPage.tsx')].join('\n');

    expect(usecase).toContain('AgentGuard lets an assistant search ONDC');
    expect(usecase).not.toContain('PreProd');
    expect(usecase).not.toContain('Demo scope');
    expect(usecase).not.toContain('anchor a wallet-bound proof on Solana');
    expect(usecase).not.toContain('AadhaarChain verifies you once');
    expect(usecase).not.toContain('re-checked against AadhaarChain trust');
    expect(buyerUi).toContain('Find groceries on ONDC.');
    expect(buyerUi).toContain('Ask Samantha. Shop on ONDC.');
    expect(buyerUi).not.toContain('PreProd');
    expect(buyerUi).not.toContain('Demo scope');
    expect(manifest).not.toContain('@solana/');
    expect(manifest).not.toContain('"bs58"');
    expect(entrypoint).not.toContain('WalletProvider');
  });
});
