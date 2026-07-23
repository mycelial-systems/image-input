import { WebComponent } from '@substrate-system/web-component'
import { createDebug } from '@substrate-system/debug'
import { fitWidth, scaleFor, toDisplayRect, type CropRect } from './crop-math.js'
const debug = createDebug('image-crop')

// for document.querySelector
declare global {
    interface HTMLElementTagNameMap {
        'image-crop': ImageCrop
    }
}

export type { CropRect }

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

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

    connectedCallback () {
        debug('connected')
        super.connectedCallback()
        this.qs('img')?.addEventListener('load', this.#handleImageLoad)
        window.addEventListener('resize', this.#handleResize)
    }

    disconnectedCallback () {
        debug('disconnected')
        this.qs('img')?.removeEventListener('load', this.#handleImageLoad)
        window.removeEventListener('resize', this.#handleResize)
        this.#revokeObjectUrl()
    }

    handleChange_src (_old:string|null, newValue:string|null) {
        const img = this.qs('img')
        if (img) img.src = newValue ?? ''
    }

    /**
     * Load a file into the cropper, replacing any previously-set image.
     */
    setFile (file:File):void {
        this.#revokeObjectUrl()
        this.#file = file
        this.#objectUrl = URL.createObjectURL(file)
        this.src = this.#objectUrl
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

    #layout ():void {
        const frame = this.qs<HTMLElement>('.image-crop-frame')
        const img = this.qs('img')
        const rect = this.qs<HTMLElement>('.crop-rect')
        if (!frame || !img || !rect || !this.#naturalWidth) return

        const displayWidth = this.clientWidth
        const displaySize = fitWidth(
            this.#naturalWidth, this.#naturalHeight, displayWidth
        )
        frame.style.width = `${displaySize.width}px`
        frame.style.height = `${displaySize.height}px`
        img.style.width = `${displaySize.width}px`
        img.style.height = `${displaySize.height}px`

        const scale = scaleFor(this.#naturalWidth, displayWidth)
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
            <div class="crop-rect">${handles}</div>
        </div>`
    }
}

ImageCrop.define()
