export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://renddre2.github.io/radarsmart-br').replace(/\/$/, '');
}

export function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || '';
}

export function withBasePath(assetPath: string): string {
  const bp = getBasePath();
  if (!assetPath.startsWith('/')) return `${bp}/${assetPath}`;
  return `${bp}${assetPath}`;
}
