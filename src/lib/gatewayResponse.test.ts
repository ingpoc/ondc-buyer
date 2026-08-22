import { describe, expect, it } from 'vitest';
import { isSpaHtmlResponse, throwIfSpaHtml } from './gatewayResponse';

function response(contentType: string) {
  return new Response('<!DOCTYPE html>', {
    status: 200,
    headers: { 'content-type': contentType },
  });
}

describe('gateway HTML guard', () => {
  it('treats the Vite SPA shell as a missing API rewrite', () => {
    const html = response('text/html; charset=utf-8');
    Object.defineProperty(html, 'url', {
      value: 'https://ondcbuyer.aadharcha.in/api/commerce/v1/payments/config',
    });
    expect(isSpaHtmlResponse(html)).toBe(true);
    expect(() => throwIfSpaHtml(html, 'Payments config')).toThrow(/HTML instead of JSON/);
  });

  it('accepts gateway JSON content types', () => {
    expect(isSpaHtmlResponse(response('application/json'))).toBe(false);
  });
});
