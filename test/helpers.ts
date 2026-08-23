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
 * Wait until an `<image-crop>` is usable: its image has decoded and
 * its crop rect has been fitted to the natural size.
 *
 * This waits on the element's own `image-crop:load` rather than the
 * inner `<img>`'s native `load`. The two fire in that order, and it is
 * the component's event that means the crop rect and `getBlob()` are
 * ready, which is what every caller actually wants. The synchronous
 * shortcut covers being called after the load has already happened.
 */
export function waitForImageLoad (el:ImageCrop):Promise<void> {
    if (el.crop.width) return Promise.resolve()

    return new Promise(resolve => {
        el.addEventListener('image-crop:load', () => resolve(), {
            once: true
        })
    })
}

/**
 * Wait until an `<image-crop>`'s crop rect reports the given natural
 * width. Unlike `waitForImageLoad`, this works for the *second* image
 * loaded into the same element, where the element may already be
 * reporting the previous image's rect when this is called.
 */
export function waitForCropRect (
    el:ImageCrop,
    width:number
):Promise<void> {
    if (el.crop.width === width) return Promise.resolve()

    return new Promise(resolve => {
        const onLoad = () => {
            if (el.crop.width !== width) return
            el.removeEventListener('image-crop:load', onLoad)
            resolve()
        }
        el.addEventListener('image-crop:load', onLoad)
    })
}
