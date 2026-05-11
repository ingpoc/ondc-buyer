export function shouldUseLocalCartFallback(commerceDemoMode: boolean): boolean {
  return commerceDemoMode;
}

export function formatCartApiError(error: unknown, action: string): string {
  const detail = error instanceof Error ? error.message : 'Unknown error';
  return `${action} failed against the commerce API: ${detail}`;
}
