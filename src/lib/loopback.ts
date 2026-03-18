export function normalizeLoopbackUrl(url: string): string {
  if (!import.meta.env.DEV) {
    return url;
  }

  return url.replace('://localhost:', '://127.0.0.1:');
}
