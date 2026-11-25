/**
 * The photo's pixels (spec 8.9): import and decode. Kept in the engine (CLAUDE.md: all drawing sits in src/engine/);
 * the app hands it a file and stores the blob it gets back. Nothing here leaves the phone.
 */
import type { Ctx } from './graphics/types';
import { PHOTO_FLAT } from '../data/palettes/system';
import { gridOf, gridSize, keptSize, type PhotoData } from './photo';

function surface(w: number, h: number): { c: HTMLCanvasElement | OffscreenCanvas; ctx: Ctx } {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  return { c, ctx: c.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as Ctx };
}
async function blobOf(c: HTMLCanvasElement | OffscreenCanvas, type: string, q: number): Promise<Blob> {
  if ('convertToBlob' in c) return c.convertToBlob({ type, quality: q });
  return new Promise((ok, no) => (c as HTMLCanvasElement).toBlob((b) => (b ? ok(b) : no(new Error('encode failed'))), type, q));
}

/**
 * A file from the phone as the photo is kept (spec 8.9): orientation corrected (the camera's rotation applied), long
 * edge at most 5000 px, flattened on white, JPEG at 0.92. Throws if the file is not a picture the browser can read.
 */
export async function importPicture(file: Blob): Promise<{ blob: Blob; w: number; h: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const [w, h] = keptSize(bmp.width, bmp.height), { c, ctx } = surface(w, h);
    ctx.fillStyle = PHOTO_FLAT;
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, h);
    return { blob: await blobOf(c, 'image/jpeg', 0.92), w, h };
  } finally { bmp.close(); }
}

/** A kept photo decoded for drawing, with the grid layout measures contrast against. */
export async function decodePhoto(id: string, blob: Blob): Promise<PhotoData> {
  const img = await createImageBitmap(blob);
  const [gw, gh] = gridSize(img.width, img.height), { ctx } = surface(gw, gh);
  ctx.drawImage(img, 0, 0, gw, gh);
  return { id, w: img.width, h: img.height, grid: gridOf(ctx.getImageData(0, 0, gw, gh).data, gw, gh), img };
}

/** A test photo with its picture (the tools' "test photo", spec 9.4): drawn from testPicture, as a JPEG blob. */
export async function testBlob(w: number, h: number, pixels: Uint8ClampedArray): Promise<Blob> {
  const { c, ctx } = surface(w, h);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), w, h), 0, 0);
  return blobOf(c, 'image/jpeg', 0.92);
}
