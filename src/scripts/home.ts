// Home page entry: wires the asset board. A row is a real link; a plain click or Enter
// opens it through the shared Open route, and pointing at or focusing a row is a Preview.
// Modified and middle clicks keep the link's own behaviour. The site's own tab never
// navigates.
import { assetOf, boardRows } from './assets';
import { onOpened, openAsset } from './open';
import { getPreview, setPreview } from './preview';

const rows = boardRows();

for (const row of rows) {
  const asset = assetOf(row);
  const clear = () => {
    if (getPreview() === asset.index) setPreview(null);
  };
  // Touch has no pointing: a tap on a row opens it, so only a mouse or pen previews.
  row.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && setPreview(asset.index));
  row.addEventListener('pointerleave', clear);
  row.addEventListener('focus', () => setPreview(asset.index));
  row.addEventListener('blur', clear);
  row.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openAsset(asset);
  });
}

// A successful Open marks the row: "Opened ↗", like a visited link, for this visit.
onOpened(({ index }) => {
  const row = rows[index];
  row.dataset.opened = 'true';
  row.querySelector<HTMLElement>('.opened')!.hidden = false;
});
