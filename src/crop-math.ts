export interface DisplaySize {
    width:number
    height:number
}

export interface CropRect {
    x:number
    y:number
    width:number
    height:number
}

/**
 * Given a container width and an image's natural dimensions, compute
 * the displayed size that fits the container width while preserving
 * the image's aspect ratio (equivalent to `width:100%; height:auto`).
 * Pure function so it is unit-testable without a real DOM layout.
 */
export function fitWidth (
    naturalWidth:number,
    naturalHeight:number,
    displayWidth:number
):DisplaySize {
    if (naturalWidth <= 0) return { width: displayWidth, height: 0 }
    const scale = displayWidth / naturalWidth
    return { width: displayWidth, height: naturalHeight * scale }
}

/**
 * Scale factor between natural-image pixels and displayed pixels,
 * given the current displayed width.
 */
export function scaleFor (naturalWidth:number, displayWidth:number):number {
    if (naturalWidth <= 0) return 1
    return displayWidth / naturalWidth
}

/**
 * Convert a crop rect from natural-image pixels to displayed pixels.
 */
export function toDisplayRect (
    crop:CropRect,
    scale:number
):CropRect {
    return {
        x: crop.x * scale,
        y: crop.y * scale,
        width: crop.width * scale,
        height: crop.height * scale
    }
}
