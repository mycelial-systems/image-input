import type { ImageCrop } from '../src/crop.js'
import { imageDataUrl } from './fixture.js'

let fixture:Promise<HTMLImageElement>|null = null

/**
 * Decode the base64 fixture once. Every sized image in the suite is
 * drawn from this one decode.
 */
function loadFixture ():Promise<HTMLImageElement> {
    if (fixture) return fixture

    fixture = new Promise((resolve, reject) => {
        const img = new Image()
        img.addEventListener('load', () => resolve(img), { once: true })
        img.addEventListener('error', () => {
            reject(new Error('the base64 fixture image failed to decode'))
        }, { once: true })
        img.src = imageDataUrl()
    })

    return fixture
}

/**
 * Draw the fixture image at exactly `width` x `height` and resolve it
 * as a real, decodable image File. Used wherever a test needs an
 * `<image-crop>` (or `<image-input>`'s lazily created one) to have a
 * genuinely loaded image at a known size -- `naturalWidth`/
 * `naturalHeight` and `getBlob()`'s canvas draw both depend on that,
 * and a hand-built `File` of arbitrary bytes does not decode.
 *
 * The aspect ratio is deliberately not preserved: callers pick the
 * dimensions they assert on.
 */
export async function makeImageFile (
    width:number,
    height:number
):Promise<File> {
    const img = await loadFixture()

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    ctx.drawImage(img, 0, 0, width, height)

    return new Promise((resolve) => {
        canvas.toBlob(blob => {
            resolve(new File([blob as Blob], 'photo.png', {
                type: 'image/png'
            }))
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

/**
 * Wait until an `<image-crop>`'s crop rect reports the given natural
 * width. Unlike `waitForImageLoad`, this works for the *second* image
 * loaded into the same element, where the `<img>` may report itself
 * complete from the previous load before the new one has decoded.
 */
export async function waitForCropRect (
    el:ImageCrop,
    width:number
):Promise<void> {
    while (el.crop.width !== width) {
        await new Promise(resolve => setTimeout(resolve, 10))
    }
}
