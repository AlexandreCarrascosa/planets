// Vite replaces BASE_URL at build time. The fallback also permits Node tests.
export function assetUrl(path) {
  return `${import.meta.env?.BASE_URL ?? "/"}${path.replace(/^\/+/, "")}`;
}
