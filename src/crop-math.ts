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
 * Given an available box (max width and max height) and an image's
 * natural dimensions, compute the largest display size that fits inside
 * the box while preserving the aspect ratio. A `maxHeight` of 0 (or
 * less) means the height is unconstrained, in which case this behaves
 * like `fitWidth`. Pure function so it is unit-testable without a real
 * DOM layout.
 */
export function fitWithin (
    naturalWidth:number,
    naturalHeight:number,
    maxWidth:number,
    maxHeight:number
):DisplaySize {
    if (naturalWidth <= 0 || naturalHeight <= 0) {
        return { width: maxWidth, height: 0 }
    }
    const scaleW = maxWidth / naturalWidth
    const scale = maxHeight > 0 ?
        Math.min(scaleW, maxHeight / naturalHeight) :
        scaleW
    return { width: naturalWidth * scale, height: naturalHeight * scale }
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

/**
 * Convert a crop rect from displayed pixels back to natural-image pixels.
 */
export function toNaturalRect (
    displayRect:CropRect,
    scale:number
):CropRect {
    return {
        x: displayRect.x / scale,
        y: displayRect.y / scale,
        width: displayRect.width / scale,
        height: displayRect.height / scale
    }
}

/**
 * Constrain a rect so it stays fully inside the given bounds, without
 * changing its size.
 */
export function clampRect (rect:CropRect, bounds:DisplaySize):CropRect {
    const width = Math.min(rect.width, bounds.width)
    const height = Math.min(rect.height, bounds.height)
    const x = Math.min(Math.max(rect.x, 0), bounds.width - width)
    const y = Math.min(Math.max(rect.y, 0), bounds.height - height)
    return { x, y, width, height }
}

/**
 * Move a rect by (dx, dy), clamped so it cannot leave the bounds.
 */
export function moveRect (
    rect:CropRect,
    dx:number,
    dy:number,
    bounds:DisplaySize
):CropRect {
    return clampRect(
        { ...rect, x: rect.x + dx, y: rect.y + dy },
        bounds
    )
}

export type HandleDir = 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'

/**
 * Resize a rect by dragging one of its 8 handles by (dx, dy). Corner
 * handles resize both axes; edge handles resize a single axis. The
 * result is clamped to the given bounds and never shrinks below
 * `minSize` on either axis.
 */
export function resizeRect (
    rect:CropRect,
    handle:HandleDir,
    dx:number,
    dy:number,
    bounds:DisplaySize,
    minSize:number
):CropRect {
    const { x, y, width, height } = rect
    const right = x + width
    const bottom = y + height

    const affectsLeft = (handle === 'nw' || handle === 'w' || handle === 'sw')
    const affectsRight = (handle === 'ne' || handle === 'e' || handle === 'se')
    const affectsTop = (handle === 'nw' || handle === 'n' || handle === 'ne')
    const affectsBottom = (handle === 'sw' || handle === 's' || handle === 'se')

    const newX = affectsLeft ?
        Math.min(Math.max(x + dx, 0), right - minSize) :
        x
    const newRight = affectsRight ?
        Math.max(Math.min(right + dx, bounds.width), x + minSize) :
        right
    const newY = affectsTop ?
        Math.min(Math.max(y + dy, 0), bottom - minSize) :
        y
    const newBottom = affectsBottom ?
        Math.max(Math.min(bottom + dy, bounds.height), y + minSize) :
        bottom

    return {
        x: newX,
        y: newY,
        width: newRight - newX,
        height: newBottom - newY
    }
}
