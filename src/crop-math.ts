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
export type CornerDir = 'nw'|'ne'|'se'|'sw'

export const CORNER_DIRS:CornerDir[] = ['nw', 'ne', 'se', 'sw']

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

const CORNER_SIGN:Record<CornerDir, { signX:number, signY:number }> = {
    nw: { signX: -1, signY: -1 },
    ne: { signX: 1, signY: -1 },
    se: { signX: 1, signY: 1 },
    sw: { signX: -1, signY: 1 }
}

/**
 * Resize a rect by dragging one of its 4 corner handles by (dx, dy),
 * keeping `width / height` equal to `ratio` throughout. The opposite
 * corner is the anchor and never moves. Growth is clamped to `bounds`
 * by shrinking the rect proportionally rather than letting either
 * axis push past an edge, so the ratio can never break. Never shrinks
 * below `minSize` on either axis.
 */
export function resizeRectLocked (
    rect:CropRect,
    handle:CornerDir,
    dx:number,
    dy:number,
    bounds:DisplaySize,
    minSize:number,
    ratio:number
):CropRect {
    const { signX, signY } = CORNER_SIGN[handle]
    const anchorX = signX > 0 ? rect.x : rect.x + rect.width
    const anchorY = signY > 0 ? rect.y : rect.y + rect.height

    // Two candidate sizes, each preserving the ratio -- one driven by
    // the horizontal delta, one by the vertical. A diagonal drag (both
    // nonzero) picks whichever candidate has the larger area, so the
    // rect grows as far as the user actually dragged. A drag or
    // keyboard step on a single axis leaves the other delta at exactly
    // zero -- the larger-area candidate would then always be the
    // *unchanged* axis (its area never shrinks), which would make
    // shrinking via one axis impossible. Drive off that axis alone
    // instead whenever the other is exactly zero.
    const widthFromDx = rect.width + dx * signX
    const heightFromDy = rect.height + dy * signY

    let width:number
    let height:number
    if (dy === 0 && dx !== 0) {
        width = widthFromDx
        height = widthFromDx / ratio
    } else if (dx === 0 && dy !== 0) {
        width = heightFromDy * ratio
        height = heightFromDy
    } else {
        const areaA = widthFromDx > 0 ? widthFromDx * widthFromDx / ratio : -1
        const areaB = heightFromDy > 0 ?
            heightFromDy * heightFromDy * ratio :
            -1
        if (areaA >= areaB) {
            width = widthFromDx
            height = widthFromDx / ratio
        } else {
            width = heightFromDy * ratio
            height = heightFromDy
        }
    }

    const minWidth = Math.max(minSize, minSize * ratio)
    if (width < minWidth) {
        width = minWidth
        height = width / ratio
    }

    // Clamp so the anchored rect stays inside bounds, shrinking both
    // axes by the same factor rather than breaking the ratio.
    const maxWidth = signX > 0 ? bounds.width - anchorX : anchorX
    const maxHeight = signY > 0 ? bounds.height - anchorY : anchorY
    const scale = Math.min(1, maxWidth / width, maxHeight / height)
    if (scale < 1) {
        width *= scale
        height *= scale
    }

    return {
        x: signX > 0 ? anchorX : anchorX - width,
        y: signY > 0 ? anchorY : anchorY - height,
        width,
        height
    }
}

/**
 * The largest rect of the given `ratio` (width / height) that fits
 * inside a `naturalWidth` x `naturalHeight` image, centered.
 */
export function fitRatioRect (
    ratio:number,
    naturalWidth:number,
    naturalHeight:number
):CropRect {
    let width = naturalWidth
    let height = width / ratio
    if (height > naturalHeight) {
        height = naturalHeight
        width = height * ratio
    }
    return {
        x: (naturalWidth - width) / 2,
        y: (naturalHeight - height) / 2,
        width,
        height
    }
}

/**
 * Parse a CSS `aspect-ratio`-style value: a bare number (`0.75`) or a
 * `w/h` ratio (`3/4`, `3 / 4`). Returns `null` for anything that does
 * not resolve to a finite, positive ratio.
 */
export function parseAspectRatio (raw:string):number|null {
    const trimmed = raw.trim()
    if (!trimmed) return null

    const slash = trimmed.match(/^(-?[\d.]+)\s*\/\s*(-?[\d.]+)$/)
    let value:number
    if (slash) {
        const w = Number(slash[1])
        const h = Number(slash[2])
        if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) {
            return null
        }
        value = w / h
    } else {
        value = Number(trimmed)
    }

    return (Number.isFinite(value) && value > 0) ? value : null
}

/**
 * A parsed `crop` attribute value. `'constrain'` defers the ratio to
 * whatever image is loaded; `'ratio'` already knows its number,
 * whether it came from a literal or the `circle` keyword.
 */
export type CropConstraint =
    | { kind:'constrain' }
    | { kind:'ratio', ratio:number, circle:boolean }

/**
 * Parse the `crop` attribute's three value forms -- `constrain`,
 * `circle`, and a CSS `aspect-ratio` literal -- into one shape.
 * Returns `null` for no value, an empty value, or anything unusable,
 * which callers treat as free-form cropping.
 */
export function parseCropAttribute (
    raw:string|null|undefined
):CropConstraint|null {
    if (raw == null) return null
    const trimmed = raw.trim()
    if (!trimmed) return null
    if (trimmed === 'constrain') return { kind: 'constrain' }
    if (trimmed === 'circle') {
        return { kind: 'ratio', ratio: 1, circle: true }
    }

    const ratio = parseAspectRatio(trimmed)
    return ratio === null ? null : { kind: 'ratio', ratio, circle: false }
}

/**
 * Resolve a `CropConstraint` to a concrete aspect ratio. `constrain`
 * reads it off the loaded image's natural size, returning `null` when
 * no image has finished loading yet.
 */
export function resolveCropRatio (
    constraint:CropConstraint,
    naturalWidth:number,
    naturalHeight:number
):number|null {
    if (constraint.kind === 'constrain') {
        return (naturalWidth > 0 && naturalHeight > 0) ?
            naturalWidth / naturalHeight :
            null
    }
    return constraint.ratio
}
