import { WebComponent } from '@substrate-system/web-component'
import { createDebug } from '@substrate-system/debug'
import {
    fitWithin,
    toDisplayRect,
    toNaturalRect,
    moveRect,
    resizeRect,
    type CropRect,
    type DisplaySize,
    type HandleDir
} from './crop-math.js'
const debug = createDebug('image-crop')

// for document.querySelector
declare global {
    interface HTMLElementTagNameMap {
        'image-crop': ImageCrop
    }
}

export type { CropRect }

export interface GetBlobOptions {
    type?:string
    quality?:number
}

const HANDLES:HandleDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN_DISPLAY_SIZE = 32
const KEY_STEP = 8

const MOVE_KEYS:Record<string, [number, number]> = {
    ArrowUp: [0, -KEY_STEP],
    ArrowDown: [0, KEY_STEP],
    ArrowLeft: [-KEY_STEP, 0],
    ArrowRight: [KEY_STEP, 0]
}

interface DragState {
    mode:'move'|'resize'
    handle?:HandleDir
    pointerId:number
    startClientX:number
    startClientY:number
    startRect:CropRect
}

export class ImageCrop extends WebComponent {
    static TAG = 'image-crop'
    TAG = ImageCrop.TAG
    static reflectedStringAttributes = ['src']
    declare src:string|null

    #file:File|null = null
    #objectUrl:string|null = null
    #naturalWidth = 0
    #naturalHeight = 0
    #crop:CropRect = { x: 0, y: 0, width: 0, height: 0 }
    #drag:DragState|null = null

    connectedCallback () {
        debug('connected')
        super.connectedCallback()
        this.qs('img')?.addEventListener('load', this.#handleImageLoad)
        window.addEventListener('resize', this.#handleResize)
        this.qs<HTMLElement>('.crop-rect')?.addEventListener(
            'pointerdown', this.#handleMoveStart
        )
        this.qs<HTMLElement>('.crop-rect')?.addEventListener(
            'keydown', this.#handleKeyDown
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
        window.removeEventListener('resize', this.#handleResize)
        window.removeEventListener('pointermove', this.#handlePointerMove)
        window.removeEventListener('pointerup', this.#handlePointerEnd)
        window.removeEventListener('pointercancel', this.#handlePointerEnd)
        this.#revokeObjectUrl()
    }

    handleChange_src (_old:string|null, newValue:string|null) {
        const img = this.qs('img')
        if (img) img.src = newValue ?? ''
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
        const type = opts?.type ?? 'image/jpeg'

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
        if (img) {
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
        this.#crop = {
            x: 0,
            y: 0,
            width: this.#naturalWidth,
            height: this.#naturalHeight
        }
        this.#layout()
    }

    #handleResize = ():void => {
        this.#layout()
    }

    /**
     * The displayed image size, fitted to the element's available width
     * *and* height so a tall image never overflows its container.
     */
    #fitted ():DisplaySize {
        return fitWithin(
            this.#naturalWidth,
            this.#naturalHeight,
            this.clientWidth,
            this.clientHeight
        )
    }

    /**
     * Scale factor from natural-image pixels to the current display,
     * consistent with `#fitted()`.
     */
    #scale ():number {
        if (this.#naturalWidth <= 0) return 1
        return this.#fitted().width / this.#naturalWidth
    }

    #handleMoveStart = (e:PointerEvent):void => {
        if (!this.#naturalWidth) return
        e.preventDefault()
        const rectEl = this.qs<HTMLElement>('.crop-rect')
        try {
            rectEl?.setPointerCapture(e.pointerId)
        } catch { /* not a real pointer in this environment */ }

        const scale = this.#scale()
        this.#drag = {
            mode: 'move',
            pointerId: e.pointerId,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startRect: toDisplayRect(this.#crop, scale)
        }
    }

    #handleResizeStart = (e:PointerEvent):void => {
        if (!this.#naturalWidth) return
        e.preventDefault()
        e.stopPropagation()
        const handleEl = e.currentTarget as HTMLElement
        const handle = HANDLES.find(
            dir => handleEl.classList.contains(`handle-${dir}`)
        )
        if (!handle) return

        try {
            handleEl.setPointerCapture(e.pointerId)
        } catch { /* not a real pointer in this environment */ }

        const scale = this.#scale()
        this.#drag = {
            mode: 'resize',
            handle,
            pointerId: e.pointerId,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startRect: toDisplayRect(this.#crop, scale)
        }
    }

    #handlePointerMove = (e:PointerEvent):void => {
        const drag = this.#drag
        if (!drag || e.pointerId !== drag.pointerId) return

        const dx = e.clientX - drag.startClientX
        const dy = e.clientY - drag.startClientY
        const bounds = this.#fitted()

        const newDisplayRect = drag.mode === 'move' ?
            moveRect(drag.startRect, dx, dy, bounds) :
            resizeRect(
                drag.startRect, drag.handle!, dx, dy, bounds, MIN_DISPLAY_SIZE
            )

        const scale = this.#scale()
        this.#crop = toNaturalRect(newDisplayRect, scale)
        this.#layout()
        this.emit('change', { detail: { ...this.#crop } })
    }

    #handleKeyDown = (e:KeyboardEvent):void => {
        if (!this.#naturalWidth) return
        const delta = MOVE_KEYS[e.key]
        if (!delta) return
        e.preventDefault()

        const [dx, dy] = delta
        const bounds = this.#fitted()
        const scale = this.#scale()
        const displayRect = toDisplayRect(this.#crop, scale)

        const newDisplayRect = e.shiftKey ?
            resizeRect(
                displayRect,
                (dx !== 0 ? 'e' : 's'),
                dx,
                dy,
                bounds,
                MIN_DISPLAY_SIZE
            ) :
            moveRect(displayRect, dx, dy, bounds)

        this.#crop = toNaturalRect(newDisplayRect, scale)
        this.#layout()
        this.emit('change', { detail: { ...this.#crop } })
    }

    #handlePointerEnd = (e:PointerEvent):void => {
        if (!this.#drag || e.pointerId !== this.#drag.pointerId) return
        this.#drag = null
    }

    #layout ():void {
        const frame = this.qs<HTMLElement>('.image-crop-frame')
        const img = this.qs('img')
        const rect = this.qs<HTMLElement>('.crop-rect')
        if (!frame || !img || !rect || !this.#naturalWidth) return

        const displaySize = this.#fitted()
        frame.style.width = `${displaySize.width}px`
        frame.style.height = `${displaySize.height}px`
        img.style.width = `${displaySize.width}px`
        img.style.height = `${displaySize.height}px`

        const scale = this.#scale()
        const displayRect = toDisplayRect(this.#crop, scale)

        rect.style.left = `${displayRect.x}px`
        rect.style.top = `${displayRect.y}px`
        rect.style.width = `${displayRect.width}px`
        rect.style.height = `${displayRect.height}px`

        this.#layoutDimPanels(displaySize.width, displaySize.height, displayRect)
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
        const src = this.src ?? ''
        const handles = HANDLES.map(dir => (
            `<span class="handle handle-${dir}" aria-hidden="true"></span>`
        )).join('')

        this.innerHTML = `<div class="image-crop-frame">
            <img src="${src}" alt="" />
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
        </div>`
    }
}

ImageCrop.define()
