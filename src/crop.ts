import { WebComponent } from '@substrate-system/web-component'
import { createDebug } from '@substrate-system/debug'
import { escapeAttr } from './escape.js'
import { encodableType } from './file.js'
import {
    fitWithin,
    toDisplayRect,
    toNaturalRect,
    moveRect,
    resizeRect,
    resizeRectLocked,
    fitRatioRect,
    containRatioRect,
    clampPan,
    shiftRect,
    zoomMax,
    parseCropAttribute,
    resolveCropRatio,
    type CropRect,
    type CropConstraint,
    type DisplaySize,
    type HandleDir,
    type CornerDir,
    CORNER_DIRS
} from './crop-math.js'
const debug = createDebug('image-crop')

/**
 * The `image-crop:*` events, and their `detail` shapes.
 *
 * Keys are the *non*-namespaced names taken by `.on()`/`.off()`; the
 * namespaced names (`image-crop:load`, ...) are what
 * `addEventListener` sees, and they are augmented onto
 * `HTMLElementEventMap` below. This mirrors `src/events.ts`, which
 * does the same job for `<image-input>`, but lives here rather than
 * there because `crop.ts` is a standalone entry point.
 */
export interface ImageCropEventMap {
    load:CustomEvent<{ naturalWidth:number, naturalHeight:number }>
    change:CustomEvent<CropRect>
}

// for document.querySelector
declare global {
    interface HTMLElementTagNameMap {
        'image-crop': ImageCrop
    }

    /**
     * These events bubble, so listening on an ancestor is a supported
     * pattern, not just listening on the `<image-crop>` itself.
     */
    interface HTMLElementEventMap {
        'image-crop:load':ImageCropEventMap['load']
        'image-crop:change':ImageCropEventMap['change']
    }
}

export type { CropRect }

export interface GetBlobOptions {
    type?:string
    quality?:number
}

/**
 * The padding color of a zoomed-out crop when `fill` is not set.
 */
export const DEFAULT_FILL = '#fff'

/**
 * How far past the image, in natural pixels, a rect must reach before it
 * counts as padded. Clamping and zooming in floating point can leave an
 * edge a hair past the image without any real padding.
 */
const PAD_EPSILON = 1e-6

const HANDLES:HandleDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN_DISPLAY_SIZE = 32
const KEY_STEP = 8
const ZOOM_STEP = 1.1

const MOVE_KEYS:Record<string, [number, number]> = {
    ArrowUp: [0, -KEY_STEP],
    ArrowDown: [0, KEY_STEP],
    ArrowLeft: [-KEY_STEP, 0],
    ArrowRight: [KEY_STEP, 0]
}

/**
 * The zoom factor of shift plus an arrow key under a lock.
 */
const ZOOM_KEYS:Record<string, number> = {
    ArrowUp: ZOOM_STEP,
    ArrowRight: ZOOM_STEP,
    ArrowDown: 1 / ZOOM_STEP,
    ArrowLeft: 1 / ZOOM_STEP
}

/**
 * A free-form drag works on the rect in display pixels. A locked pan
 * works on `#crop` in natural pixels, at the scale it started with. A
 * locked window drag works on the window in display pixels, with the
 * image held where it started: a corner `handle` resizes it, and a
 * `null` one moves it.
 */
type DragState = {
    pointerId:number
    startClientX:number
    startClientY:number
} & (
    | { mode:'move', startRect:CropRect }
    | { mode:'resize', handle:HandleDir, startRect:CropRect }
    | { mode:'pan', startCrop:CropRect, scale:number }
    | {
        mode:'window',
        handle:CornerDir|null,
        startRect:CropRect,
        image:CropRect,
        scale:number
    }
)

/**
 * Where the image and the crop rect sit in the frame, in display
 * pixels, and how many display pixels one natural pixel spans.
 */
interface View {
    frame:DisplaySize
    scale:number
    image:CropRect
    rect:CropRect
}

function place (el:HTMLElement, box:CropRect):void {
    el.style.left = `${box.x}px`
    el.style.top = `${box.y}px`
    el.style.width = `${box.width}px`
    el.style.height = `${box.height}px`
}

export class ImageCrop extends WebComponent {
    static TAG = 'image-crop'
    TAG = ImageCrop.TAG
    static reflectedStringAttributes = ['src', 'crossorigin', 'fill']
    declare src:string|null
    declare crossorigin:string|null
    /**
     * The color painted where a zoomed-out crop extends past the image,
     * on screen and in `getBlob()`. Any canvas `fillStyle` color;
     * `DEFAULT_FILL` when unset.
     */
    declare fill:string|null

    /**
     * `crop` is deliberately *not* in `reflectedStringAttributes`.
     * `ImageCrop.prototype` already has a `crop` getter (the current
     * crop rect, below) -- `WebComponent.define()` skips generating a
     * reflected accessor for any name that already has an own property
     * descriptor, so a `crop` string property would silently fail to
     * exist rather than override it. The attribute is still observed
     * (see `observedAttributes` below) and drives `handleChange_crop`;
     * set it with `setAttribute('crop', ...)`, not `el.crop = ...`.
     */
    static get observedAttributes ():string[] {
        return [...super.observedAttributes, 'crop']
    }

    #file:File|null = null
    #objectUrl:string|null = null
    #naturalWidth = 0
    #naturalHeight = 0
    #crop:CropRect = { x: 0, y: 0, width: 0, height: 0 }
    /**
     * The locked window, in the frame's natural pixels (the space a
     * free-form rect lives in), so it scales with the frame. `null` is
     * the largest window of the ratio, centered.
     */
    #window:CropRect|null = null
    #drag:DragState|null = null
    #constraint:CropConstraint|null = null
    #ratio:number|null = null
    #circle = false

    connectedCallback () {
        debug('connected')
        super.connectedCallback()
        this.qs('img')?.addEventListener('load', this.#handleImageLoad)
        window.addEventListener('resize', this.#handleResize)
        this.qs<HTMLElement>('.image-crop-frame')?.addEventListener(
            'pointerdown', this.#handlePanStart
        )
        this.qs<HTMLElement>('.crop-rect')?.addEventListener(
            'pointerdown', this.#handleMoveStart
        )
        this.qs<HTMLElement>('.crop-rect')?.addEventListener(
            'keydown', this.#handleKeyDown
        )
        this.qs<HTMLInputElement>('.image-crop-zoom input')?.addEventListener(
            'input', this.#handleZoom
        )
        Array.from(this.querySelectorAll<HTMLElement>('.handle')).forEach(
            handle => {
                handle.addEventListener(
                    'pointerdown', this.#handleResizeStart
                )
            }
        )
        window.addEventListener('pointermove', this.#handlePointerMove)
        window.addEventListener('pointerup', this.#handlePointerEnd)
        window.addEventListener('pointercancel', this.#handlePointerEnd)
    }

    disconnectedCallback () {
        debug('disconnected')
        this.qs('img')?.removeEventListener('load', this.#handleImageLoad)
        this.qs<HTMLElement>('.crop-rect')?.removeEventListener(
            'keydown', this.#handleKeyDown
        )
        this.qs<HTMLInputElement>('.image-crop-zoom input')
            ?.removeEventListener('input', this.#handleZoom)
        window.removeEventListener('resize', this.#handleResize)
        window.removeEventListener('pointermove', this.#handlePointerMove)
        window.removeEventListener('pointerup', this.#handlePointerEnd)
        window.removeEventListener('pointercancel', this.#handlePointerEnd)
        this.#revokeObjectUrl()
    }

    #applyCrossOrigin (img:HTMLImageElement):void {
        if (this.crossorigin == null) {
            img.removeAttribute('crossorigin')
        } else {
            img.setAttribute('crossorigin', this.crossorigin)
        }
    }

    handleChange_src (old:string|null, newValue:string|null) {
        if (newValue === old) return
        // Anything but the object URL setFile() just made means a new
        // image from outside: forget the old file, its object URL, and
        // its size and rect, exactly as setFile() does, so crop and
        // getBlob() cannot report the previous image.
        if (newValue !== this.#objectUrl) {
            this.#revokeObjectUrl()
            this.#file = null
            this.#naturalWidth = 0
            this.#naturalHeight = 0
            this.#crop = { x: 0, y: 0, width: 0, height: 0 }
        }
        const img = this.qs<HTMLImageElement>('img')
        if (!img) return
        this.#applyCrossOrigin(img)
        img.src = newValue ?? ''
    }

    handleChange_crossorigin () {
        const img = this.qs<HTMLImageElement>('img')
        if (img) this.#applyCrossOrigin(img)
    }

    handleChange_fill () {
        this.#layout()
    }

    /**
     * Re-parses the `crop` constraint and, if an image is already
     * loaded, re-fits the rect to it right away. Before an image has
     * loaded there is nothing to fit yet -- `#handleImageLoad` applies
     * `#constraint` itself once one has.
     */
    handleChange_crop (_old:string|null, newValue:string|null) {
        this.#parseConstraint(newValue)
        if (!this.#naturalWidth) return

        this.#crop = this.#ratio ?
            fitRatioRect(this.#ratio, this.#naturalWidth, this.#naturalHeight) :
            {
                x: 0,
                y: 0,
                width: this.#naturalWidth,
                height: this.#naturalHeight
            }
        this.#window = null
        this.#layout()
        this.emit('change', { detail: { ...this.#crop } })
    }

    /**
     * Parse the `crop` attribute into `#constraint`/`#ratio`/`#circle`.
     * A value that is not `constrain`, `circle`, or a usable ratio
     * falls back to free-form cropping (matching no attribute at all)
     * and is reported through the debug channel rather than thrown.
     */
    #parseConstraint (raw:string|null):void {
        const parsed = parseCropAttribute(raw)
        if (raw && raw.trim() && !parsed) {
            debug('unrecognized crop value, falling back to ' +
                'free-form crop:', raw)
        }
        this.#constraint = parsed
        this.#circle = parsed?.kind === 'ratio' && parsed.circle
        this.#ratio = parsed ?
            resolveCropRatio(parsed, this.#naturalWidth, this.#naturalHeight) :
            null
    }

    /**
     * Load a file into the cropper, replacing any previously-set image.
     *
     * The natural size and the crop rect are reset here, not only in
     * `#handleImageLoad`. The load event is asynchronous, so between
     * this call and that event the element would otherwise still be
     * reporting the *previous* image's rect in the *previous* image's
     * coordinates. Zeroing them makes the in-between state obviously
     * empty instead of plausibly wrong, and `getBlob()` rejects rather
     * than returning a blank blob at stale dimensions.
     */
    setFile (file:File):void {
        this.#revokeObjectUrl()
        this.#file = file
        this.#naturalWidth = 0
        this.#naturalHeight = 0
        this.#crop = { x: 0, y: 0, width: 0, height: 0 }
        this.#objectUrl = URL.createObjectURL(file)
        this.src = this.#objectUrl
    }

    /**
     * The current crop rect, in natural-image pixel coordinates.
     */
    get crop ():CropRect {
        return { ...this.#crop }
    }

    /**
     * Render the current crop region to an offscreen canvas at the
     * image's natural resolution and resolve it as a Blob.
     *
     * With no `type`, the blob keeps the source file's own type when
     * the canvas can encode it, and falls back to `image/jpeg`
     * otherwise (see `encodableType` in `./file.ts`). Defaulting to
     * JPEG unconditionally would flatten a transparent PNG onto black
     * and hand back a blob whose type disagreed with the file the
     * user picked.
     *
     * Rejects if no image has finished loading -- drawing an image
     * with no decoded data is a silent no-op, which would otherwise
     * resolve a blank blob.
     */
    getBlob (opts?:GetBlobOptions):Promise<Blob> {
        if (!this.#naturalWidth) {
            return Promise.reject(new Error(
                'No image is loaded yet, so there is nothing to crop'
            ))
        }

        const img = this.qs<HTMLImageElement>('img')
        const { x, y, width, height } = this.#crop
        const type = opts?.type ?? encodableType(this.#file?.type)

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
        // A rect inside the image draws exactly as it always has, with no
        // fill, so a transparent source stays transparent. Only a locked
        // rect that reaches past the image gets the fill behind it.
        const padded = !!this.#ratio && (
            x < -PAD_EPSILON ||
            y < -PAD_EPSILON ||
            x + width > this.#naturalWidth + PAD_EPSILON ||
            y + height > this.#naturalHeight + PAD_EPSILON
        )
        if (img && padded) {
            ctx.fillStyle = this.fill ?? DEFAULT_FILL
            ctx.fillRect(0, 0, width, height)
            ctx.drawImage(img, -x, -y)
        } else if (img) {
            ctx.drawImage(img, x, y, width, height, 0, 0, width, height)
        }

        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) resolve(blob)
                else reject(new Error('Failed to create blob from canvas'))
            }, type, opts?.quality)
        })
    }

    #handleImageLoad = ():void => {
        const img = this.qs('img')
        if (!img) return
        this.#naturalWidth = img.naturalWidth
        this.#naturalHeight = img.naturalHeight

        // `constrain` can only resolve its ratio once an image is
        // loaded, so re-resolve `#ratio` against the size that just
        // became available rather than trusting whatever it was left
        // at (0, from `#parseConstraint` seeing no image yet).
        this.#ratio = this.#constraint ?
            resolveCropRatio(
                this.#constraint, this.#naturalWidth, this.#naturalHeight
            ) :
            null

        this.#crop = this.#ratio ?
            fitRatioRect(this.#ratio, this.#naturalWidth, this.#naturalHeight) :
            {
                x: 0,
                y: 0,
                width: this.#naturalWidth,
                height: this.#naturalHeight
            }
        this.#window = null
        this.#layout()

        // Loading is the one place this element becomes usable, and
        // the one `#crop` assignment that used to announce nothing.
        // `load` is the readiness signal: before it, `crop` reads
        // `{0,0,0,0}` and `getBlob()` rejects, so a consumer had no
        // supported way to know when the cropper was ready.
        // `change` keeps the invariant that every mutation of
        // `#crop` is announced -- `handleChange_crop`,
        // `#handlePointerMove` and `#handleKeyDown` all end this way
        // -- so a consumer tracking the rect from `change` alone sees
        // the initial rect and not just whatever the first drag
        // produced.
        this.emit('load', {
            detail: {
                naturalWidth: this.#naturalWidth,
                naturalHeight: this.#naturalHeight
            }
        })
        this.emit('change', { detail: { ...this.#crop } })
    }

    #handleResize = ():void => {
        this.#layout()
    }

    /**
     * The height budget for the displayed image, read from this
     * element's own `max-height`.
     *
     * Deliberately *not* `clientHeight`. `image-crop` is an auto-height
     * block, so its height comes from the frame that `#layout` just
     * sized -- measuring it would feed the previous layout back into
     * the next one, and the image could then only ever shrink. Widen
     * the window and it would stay stuck at whatever height it first
     * landed on. `max-height` is authored in CSS and never depends on
     * the content, so it is a stable ceiling.
     *
     * The zoom slider sits below the frame inside this element, so its
     * row comes out of the budget whenever it shows. Otherwise a tall
     * image fills the whole `max-height` and the slider overflows the
     * element, under whatever follows it -- the dialog's buttons. The
     * row's height does not depend on the frame, so measuring it cannot
     * start the feedback loop above.
     *
     * Returns 0, meaning unconstrained, for `none` and for anything
     * that does not resolve to pixels. A percentage against an
     * auto-height parent resolves to a percentage string rather than a
     * length, and parsing that as pixels would silently collapse the
     * image.
     */
    #maxDisplayHeight ():number {
        const raw = getComputedStyle(this).maxHeight
        if (!raw.endsWith('px')) return 0
        const px = parseFloat(raw)
        if (!Number.isFinite(px) || px <= 0) return 0
        const budget = px - this.#zoomRowHeight()
        // Never 0, which would read as unconstrained
        return Math.max(budget, 1)
    }

    /**
     * The block size the zoom slider adds below the frame, margin
     * included, or 0 while it is hidden.
     */
    #zoomRowHeight ():number {
        const label = this.qs<HTMLLabelElement>('.image-crop-zoom')
        if (!label || label.hidden) return 0
        const margin = parseFloat(getComputedStyle(label).marginBlockStart)
        return label.offsetHeight + (Number.isFinite(margin) ? margin : 0)
    }

    /**
     * The frame's size: the image fitted to the element's available
     * width *and* height, so a tall image never overflows its container.
     */
    #fitted ():DisplaySize {
        return fitWithin(
            this.#naturalWidth,
            this.#naturalHeight,
            this.clientWidth,
            this.#maxDisplayHeight()
        )
    }

    /**
     * Everything on screen, derived from `#crop` and `#window`.
     * Free-form, the image fills the frame and the rect moves over it.
     * Under a lock the rect is the window, and the image is scaled and
     * placed behind it so that `#crop` fills the window exactly. A pan
     * or a zoom then moves only the image.
     */
    #view ():View {
        const frame = this.#fitted()
        const frameScale = frame.width / this.#naturalWidth
        if (!this.#ratio) {
            return {
                frame,
                scale: frameScale,
                image: { x: 0, y: 0, ...frame },
                rect: toDisplayRect(this.#crop, frameScale)
            }
        }

        const rect = toDisplayRect(this.#window ?? fitRatioRect(
            this.#ratio, this.#naturalWidth, this.#naturalHeight
        ), frameScale)
        const scale = rect.width / this.#crop.width
        return {
            frame,
            scale,
            image: {
                x: rect.x - this.#crop.x * scale,
                y: rect.y - this.#crop.y * scale,
                width: this.#naturalWidth * scale,
                height: this.#naturalHeight * scale
            },
            rect
        }
    }

    /**
     * `from`, with the image dragged (dx, dy) display pixels behind a
     * locked window. The crop moves the other way, in natural pixels.
     */
    #panned (
        from:CropRect,
        dx:number,
        dy:number,
        scale:number
    ):CropRect {
        return clampPan(
            shiftRect(from, -dx / scale, -dy / scale),
            this.#naturalWidth,
            this.#naturalHeight
        )
    }

    /**
     * The zoom scale under a lock. Zoom is `stage.width / crop.width`,
     * where the stage is the largest crop, the one that shows the whole
     * image. So 1 is the stage, and `max` is `MAX_ZOOM_PAST_COVER` past
     * the cover rect.
     */
    #zoom (ratio:number):{ stage:CropRect, value:number, max:number } {
        const stage = containRatioRect(
            ratio, this.#naturalWidth, this.#naturalHeight
        )
        const cover = fitRatioRect(
            ratio, this.#naturalWidth, this.#naturalHeight
        )
        return {
            stage,
            value: stage.width / this.#crop.width,
            max: zoomMax(stage.width, cover.width)
        }
    }

    /**
     * `#crop` at zoom `value`, kept in range, about the center of the
     * window. Sizing off the stage rather than the ratio makes zoom 1 the
     * stage's exact size, so the encoded image cannot lose a row to float
     * error.
     */
    #zoomed (ratio:number, value:number):CropRect {
        const { stage, max } = this.#zoom(ratio)
        const zoom = Math.min(Math.max(value, 1), max)
        const width = stage.width / zoom
        const height = stage.height / zoom
        return clampPan({
            x: this.#crop.x + (this.#crop.width - width) / 2,
            y: this.#crop.y + (this.#crop.height - height) / 2,
            width,
            height
        }, this.#naturalWidth, this.#naturalHeight)
    }

    /**
     * Under a lock, a drag anywhere on the frame outside the window pans
     * the image. The window takes its own presses, see `#handleMoveStart`.
     */
    #handlePanStart = (e:PointerEvent):void => {
        if (!this.#naturalWidth || !this.#ratio) return
        e.preventDefault()
        const frame = e.currentTarget as HTMLElement
        try {
            frame.setPointerCapture(e.pointerId)
        } catch { /* not a real pointer in this environment */ }
        frame.classList.add('panning')

        this.#drag = {
            mode: 'pan',
            pointerId: e.pointerId,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startCrop: { ...this.#crop },
            scale: this.#view().scale
        }
    }

    /**
     * A drag inside the rect moves it. Under a lock that is the window,
     * moving over the still image, so the frame must not also pan.
     */
    #handleMoveStart = (e:PointerEvent):void => {
        if (!this.#naturalWidth) return
        e.preventDefault()
        if (this.#ratio) e.stopPropagation()
        const rectEl = this.qs<HTMLElement>('.crop-rect')
        try {
            rectEl?.setPointerCapture(e.pointerId)
        } catch { /* not a real pointer in this environment */ }

        const view = this.#view()
        const start = {
            pointerId: e.pointerId,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startRect: view.rect
        }
        this.#drag = this.#ratio ?
            {
                ...start,
                mode: 'window',
                handle: null,
                image: view.image,
                scale: view.scale
            } :
            { ...start, mode: 'move' }
    }

    #handleResizeStart = (e:PointerEvent):void => {
        if (!this.#naturalWidth) return
        const handleEl = e.currentTarget as HTMLElement
        const handle = HANDLES.find(
            dir => handleEl.classList.contains(`handle-${dir}`)
        )
        if (!handle) return
        // Under a lock CSS hides the edge handles, which have no honest
        // behavior (FDR-001). A press that still reaches one bubbles to
        // the window, which moves.
        const corner = CORNER_DIRS.find(dir => dir === handle)
        if (this.#ratio && !corner) return
        e.preventDefault()
        e.stopPropagation()

        try {
            handleEl.setPointerCapture(e.pointerId)
        } catch { /* not a real pointer in this environment */ }

        const view = this.#view()
        const start = {
            pointerId: e.pointerId,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startRect: view.rect
        }
        this.#drag = (this.#ratio && corner) ?
            {
                ...start,
                mode: 'window',
                handle: corner,
                image: view.image,
                scale: view.scale
            } :
            { ...start, mode: 'resize', handle }
    }

    /**
     * A locked corner drag resizes the window with the image held still,
     * so the crop becomes whatever the window now covers. The window's
     * width is held to the zoom slider's range, and `clampPan` keeps a
     * zoomed-out drag from opening up padding.
     */
    #resizedWindow (
        drag:Extract<DragState, { mode:'window' }>,
        handle:CornerDir,
        ratio:number,
        dx:number,
        dy:number
    ):void {
        const { frame } = this.#view()
        const { stage, max } = this.#zoom(ratio)
        const rect = resizeRectLocked(
            drag.startRect, handle, dx, dy, frame, ratio, {
                min: Math.max(
                    MIN_DISPLAY_SIZE * Math.max(1, ratio),
                    stage.width / max * drag.scale
                ),
                max: stage.width * drag.scale
            }
        )
        this.#window = toNaturalRect(rect, frame.width / this.#naturalWidth)
        this.#crop = clampPan(toNaturalRect(
            shiftRect(rect, -drag.image.x, -drag.image.y), drag.scale
        ), this.#naturalWidth, this.#naturalHeight)
    }

    /**
     * A locked window dragged from inside moves over the still image, so
     * the crop becomes whatever the window now covers. It stays in the
     * frame, and `clampPan` keeps it on the image the way it keeps a pan
     * from opening up padding. The window is then put back over the
     * clamped crop, so it stops at the image's edge.
     */
    #movedWindow (
        drag:Extract<DragState, { mode:'window' }>,
        dx:number,
        dy:number
    ):void {
        const { frame } = this.#view()
        const { image, scale } = drag
        this.#crop = clampPan(toNaturalRect(shiftRect(
            moveRect(drag.startRect, dx, dy, frame), -image.x, -image.y
        ), scale), this.#naturalWidth, this.#naturalHeight)
        this.#window = toNaturalRect(shiftRect(
            toDisplayRect(this.#crop, scale), image.x, image.y
        ), frame.width / this.#naturalWidth)
    }

    #handlePointerMove = (e:PointerEvent):void => {
        const drag = this.#drag
        if (!drag || e.pointerId !== drag.pointerId) return

        const dx = e.clientX - drag.startClientX
        const dy = e.clientY - drag.startClientY

        if (drag.mode === 'pan') {
            this.#crop = this.#panned(drag.startCrop, dx, dy, drag.scale)
        } else if (drag.mode === 'window') {
            if (!this.#ratio) return
            if (drag.handle) {
                this.#resizedWindow(drag, drag.handle, this.#ratio, dx, dy)
            } else {
                this.#movedWindow(drag, dx, dy)
            }
        } else {
            const { frame, scale } = this.#view()
            this.#crop = toNaturalRect(drag.mode === 'move' ?
                moveRect(drag.startRect, dx, dy, frame) :
                resizeRect(
                    drag.startRect, drag.handle, dx, dy, frame,
                    MIN_DISPLAY_SIZE
                ), scale)
        }
        this.#layout()
        this.emit('change', { detail: { ...this.#crop } })
    }

    #handleKeyDown = (e:KeyboardEvent):void => {
        if (!this.#naturalWidth) return
        const delta = MOVE_KEYS[e.key]
        if (!delta) return
        e.preventDefault()

        const [dx, dy] = delta
        const { frame, scale, rect } = this.#view()

        if (this.#ratio) {
            this.#crop = e.shiftKey ?
                this.#zoomed(
                    this.#ratio,
                    this.#zoom(this.#ratio).value * ZOOM_KEYS[e.key]
                ) :
                this.#panned(this.#crop, dx, dy, scale)
        } else {
            this.#crop = toNaturalRect(e.shiftKey ?
                resizeRect(
                    rect,
                    (dx !== 0 ? 'e' : 's'),
                    dx,
                    dy,
                    frame,
                    MIN_DISPLAY_SIZE
                ) :
                moveRect(rect, dx, dy, frame), scale)
        }
        this.#layout()
        this.emit('change', { detail: { ...this.#crop } })
    }

    /**
     * `#layout()` writes the slider's value back, which is what keeps it
     * in step with the keys too.
     */
    #handleZoom = (e:Event):void => {
        if (!this.#naturalWidth || !this.#ratio) return
        const value = Number((e.currentTarget as HTMLInputElement).value)
        this.#crop = this.#zoomed(this.#ratio, value)
        this.#layout()
        this.emit('change', { detail: { ...this.#crop } })
    }

    #handlePointerEnd = (e:PointerEvent):void => {
        if (!this.#drag || e.pointerId !== this.#drag.pointerId) return
        this.#drag = null
        this.qs<HTMLElement>('.image-crop-frame')?.classList
            .remove('panning')
    }

    #layout ():void {
        const frame = this.qs<HTMLElement>('.image-crop-frame')
        const img = this.qs<HTMLElement>('img')
        const rect = this.qs<HTMLElement>('.crop-rect')
        if (!frame || !img || !rect || !this.#naturalWidth) return

        frame.classList.toggle('locked', !!this.#ratio)
        frame.classList.toggle('circle', this.#circle)
        rect.setAttribute('aria-label', this.#ratio ?
            'Crop area, locked to a fixed shape. Drag or use arrow ' +
                'keys to move the image, and shift plus arrow keys or ' +
                'the zoom slider to zoom.' :
            'Crop area. Use arrow keys to move, shift plus arrow keys ' +
                'to resize.')

        // Before `#view()`: the slider's visibility sets the height budget
        const label = this.qs<HTMLLabelElement>('.image-crop-zoom')
        if (label) label.hidden = !this.#ratio

        const view = this.#view()
        frame.style.width = `${view.frame.width}px`
        frame.style.height = `${view.frame.height}px`
        frame.style.backgroundColor = this.#ratio ?
            (this.fill ?? DEFAULT_FILL) :
            ''
        place(img, view.image)
        place(rect, view.rect)

        this.#layoutDimPanels(view.frame.width, view.frame.height, view.rect)
        this.#layoutZoom()
    }

    /**
     * Set the zoom slider from the current rect. Every rect change ends
     * in `#layout()`, so this is the one place the slider is kept in
     * sync. `#layout()` shows or hides it.
     */
    #layoutZoom ():void {
        const input = this.qs<HTMLInputElement>('.image-crop-zoom input')
        if (!input || !this.#ratio) return

        // Set max before value: a range input clamps its value to max.
        const { value, max } = this.#zoom(this.#ratio)
        input.max = String(max)
        input.value = String(value)
    }

    #layoutDimPanels (
        displayWidth:number,
        displayHeight:number,
        displayRect:CropRect
    ):void {
        const { x, y, width, height } = displayRect

        const top = this.qs<HTMLElement>('.dim-top')
        const bottom = this.qs<HTMLElement>('.dim-bottom')
        const left = this.qs<HTMLElement>('.dim-left')
        const right = this.qs<HTMLElement>('.dim-right')

        if (top) {
            Object.assign(top.style, {
                left: '0px',
                top: '0px',
                width: `${displayWidth}px`,
                height: `${y}px`
            })
        }

        if (bottom) {
            Object.assign(bottom.style, {
                left: '0px',
                top: `${y + height}px`,
                width: `${displayWidth}px`,
                height: `${displayHeight - y - height}px`
            })
        }

        if (left) {
            Object.assign(left.style, {
                left: '0px',
                top: `${y}px`,
                width: `${x}px`,
                height: `${height}px`
            })
        }

        if (right) {
            Object.assign(right.style, {
                left: `${x + width}px`,
                top: `${y}px`,
                width: `${displayWidth - x - width}px`,
                height: `${height}px`
            })
        }
    }

    #revokeObjectUrl ():void {
        if (this.#objectUrl) {
            URL.revokeObjectURL(this.#objectUrl)
            this.#objectUrl = null
        }
    }

    render () {
        const src = escapeAttr(this.src ?? '')
        const crossorigin = this.crossorigin == null ?
            '' :
            ` crossorigin="${escapeAttr(this.crossorigin)}"`
        const handles = HANDLES.map(dir => (
            `<span class="handle handle-${dir}" aria-hidden="true"></span>`
        )).join('')

        this.innerHTML = `<div class="image-crop-frame">
            <img${crossorigin} src="${src}" alt="" />
            <div class="dim dim-top"></div>
            <div class="dim dim-bottom"></div>
            <div class="dim dim-left"></div>
            <div class="dim dim-right"></div>
            <div
                class="crop-rect"
                tabindex="0"
                role="group"
                aria-label="Crop area. Use arrow keys to move, shift plus arrow keys to resize."
            >${handles}</div>
        </div>
        <label class="image-crop-zoom" hidden>
            <span>Zoom</span>
            <input type="range" min="1" max="1" step="any" value="1" />
        </label>`
    }
}

ImageCrop.define()
