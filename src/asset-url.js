const CDN_ROOT = 'https://cdn.jsdelivr.net/gh/eunye0ngpark/azur-300@main/public';

// GitHub Pages serves the small application bundle. Public model and texture
// files use the CDN only in production; local previews and the offline edition
// continue to use their packaged relative paths.
export function assetURL(path) {
  const relative = path.startsWith('./') ? path : `./${path}`;
  if (location.hostname !== 'eunye0ngpark.github.io') return relative;
  return `${CDN_ROOT}/${relative.slice(2)}?v=full-quality`;
}
