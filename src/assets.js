// The offline edition embeds exactly the same files as the hosted viewer.
export function installPackedAssets(manager) {
  const bundle = document.getElementById('packed-assets');
  if (!bundle) return;
  const entries = JSON.parse(bundle.textContent);
  manager.setURLModifier(url => entries[url.replace(/^(\.\/|\/)/, '')] ?? url);
}
