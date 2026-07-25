import type { ImageCrop } from '../src/crop.js'

/**
 * Render a solid-color rectangle to a canvas and resolve it as a real,
 * decodable image File. Used wherever a test needs an `<image-crop>`
 * (or `<image-input>`'s lazily created one) to have a genuinely loaded
 * image -- `naturalWidth`/`naturalHeight` and `getBlob()`'s canvas
 * draw both depend on that, and a hand-built `File` of arbitrary bytes
 * does not decode.
 */
export function makeImageFile (
    width:number,
    height:number,
    color = '#ff0000'
):Promise<File> {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    ctx.fillStyle = color
    ctx.fillRect(0, 0, width, height)

    return new Promise((resolve) => {
        canvas.toBlob(blob => {
            resolve(new File([blob as Blob], 'photo.png', { type: 'image/png' }))
        }, 'image/png')
    })
}

/**
 * Wait for an `<image-crop>`'s internal `<img>` to finish loading, so
 * its natural size (and therefore its crop rect and `getBlob()`
 * output) are populated.
 */
export function waitForImageLoad (el:ImageCrop):Promise<void> {
    return new Promise(resolve => {
        const img = el.querySelector('img') as HTMLImageElement
        if (img.complete && img.naturalWidth) return resolve()
        img.addEventListener('load', () => resolve(), { once: true })
    })
}
