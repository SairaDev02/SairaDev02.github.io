// Rasterises Pixelify Sans text into an aliased 0/1 mask for in-canvas lettering.

export interface MaskText {
  text: string;
  x: number;
  y: number;
  size: number;
  weight?: number;
  align?: CanvasTextAlign;
}

const FONT = '"Pixelify Sans"';

export async function textMask(W: number, H: number, items: MaskText[]): Promise<Uint8Array> {
  await Promise.all(items.map((it) => document.fonts.load(`${it.weight ?? 700} ${it.size}px ${FONT}`)));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  for (const it of items) {
    ctx.font = `${it.weight ?? 700} ${it.size}px ${FONT}`;
    ctx.textAlign = it.align ?? 'center';
    ctx.fillText(it.text, it.x, it.y);
  }
  const a = ctx.getImageData(0, 0, W, H).data;
  const m = new Uint8Array(W * H);
  for (let i = 0; i < m.length; i++) m[i] = a[i * 4 + 3] > 110 ? 1 : 0;
  return m;
}
