import type { ImageAsset, ImageElement, ElementRect } from './types'

export function imageBox(asset: ImageAsset, pageWidth: number, pageHeight: number): ElementRect {
  const w = Math.min(0.32, (0.25 * pageHeight * asset.width) / (pageWidth * asset.height))
  const h = (w * pageWidth * asset.height) / (pageHeight * asset.width)
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
}

export function resizedImageBox(box: ElementRect, width: number): ElementRect {
  const ratio = box.h / box.w
  const w = Math.max(0.01, Math.min(width, 1 - box.x, (1 - box.y) / ratio))
  return { ...box, w, h: w * ratio }
}

export function createImageElement(
  asset: ImageAsset,
  number: number,
  pw: number,
  ph: number
): ImageElement {
  return { id: crypto.randomUUID(), kind: 'image', number, asset, bbox: imageBox(asset, pw, ph) }
}

export async function readImageAsset(file: File): Promise<ImageAsset> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a PNG, JPEG, or WebP image.')
  }
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.')
  const image = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    if (!image.width || !image.height || image.width * image.height > 20_000_000) {
      throw new Error('Choose an image with fewer than 20 million pixels.')
    }
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not read this image.')
    context.drawImage(image, 0, 0)
    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: image.width,
      height: image.height,
      name: file.name
    }
  } finally {
    image.close()
  }
}
