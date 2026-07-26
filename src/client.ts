import { createDebug } from '@substrate-system/debug'
import { toFile } from './file.js'
const debug = createDebug('image-input:client')

export interface ImageInputClientOptions {
    /**
     * Emit a (non-namespaced) event. Defaults to dispatching a bubbling,
     * cancelable `image-input:<type>` CustomEvent on the host element.
     */
    emit?:(type:string, detail?:unknown) => void;
    /**
     * Read the current alt text. Defaults to the preview image's `alt`
     * attribute.
     */
    getAlt?:() => string;
    /**
     * Reset the alt text when the image is removed. Defaults to clearing
     * the preview image's `alt`, un-highlighting the ALT badge, and
     * emitting `alt-change` with an empty string.
     */
    resetAlt?:() => void;
}

/**
 * Attach image-input behavior to HTML that is already in the document.
 *
 * This does not render anything -- it expects the markup produced by
 * `html()` (see `./html.ts`) to already exist under `host`. It wires up
 * the file input and the edit/remove/alt controls, owns the transient
 * selected-file and preview-URL state, and emits `image-input:*` events.
 */
export class ImageInputClient {
    readonly host:HTMLElement
    #emit:(type:string, detail?:unknown) => void
    #getAlt:() => string
    #resetAlt:() => void
    #file:File|null = null
    #previewUrl:string|null = null

    constructor (host:HTMLElement, opts:ImageInputClientOptions = {}) {
        this.host = host

        this.#emit = opts.emit ?? ((type, detail) => {
            host.dispatchEvent(new CustomEvent(`image-input:${type}`, {
                bubbles: true,
                cancelable: true,
                detail
            }))
        })

        this.#getAlt = opts.getAlt ?? (() => {
            const img = this.#qs<HTMLImageElement>('img')
            return img?.getAttribute('alt') ?? ''
        })

        this.#resetAlt = opts.resetAlt ?? (() => {
            this.#qs('img')?.setAttribute('alt', '')
            const badge = this.#qs('.alt-badge')
            if (badge) {
                badge.classList.remove('has-alt')
                badge.setAttribute('aria-label', 'Add alt text')
            }
            this.#emit('alt-change', { alt: '' })
        })

        this.#setup()
    }

    #qs<T extends Element = Element> (selector:string):T|null {
        return this.host.querySelector<T>(selector)
    }

    #setup ():void {
        debug('setup')
        this.#qs('input')?.addEventListener('change', this.#handleFileSelect)
        this.#qs('.remove')?.addEventListener('click', this.#handleRemove)
        this.#qs('.edit')?.addEventListener('click', this.#handleEdit)
        this.#qs('.alt-badge')?.addEventListener('click', this.#handleAlt)
    }

    /**
     * Remove all event listeners and revoke any outstanding preview URL.
     */
    destroy ():void {
        debug('destroy')
        this.#qs('input')
            ?.removeEventListener('change', this.#handleFileSelect)
        this.#qs('.remove')?.removeEventListener('click', this.#handleRemove)
        this.#qs('.edit')?.removeEventListener('click', this.#handleEdit)
        this.#qs('.alt-badge')?.removeEventListener('click', this.#handleAlt)
        this.#revokePreviewUrl()
    }

    #handleFileSelect = (event:Event) => {
        const input = event.target as HTMLInputElement
        const file = input.files?.[0]

        if (file && file.type.startsWith('image/')) {
            debug('Image file selected:', file.name)
            this.#setFile(file)
            this.#emit('change', { file, alt: this.#getAlt() })
        }
    }

    #handleRemove = (event:Event) => {
        event.preventDefault()
        this.clear()
        this.#emit('remove')
    }

    #handleEdit = (event:Event) => {
        event.preventDefault()
        if (!this.#file) return
        this.#emit('edit', { file: this.#file })
    }

    #handleAlt = (event:Event) => {
        event.preventDefault()
        if (!this.#file) return
        this.#emit('alt', { file: this.#file, alt: this.#getAlt() })
    }

    /**
     * Replace the preview with a Blob (e.g. a cropped image), and use it
     * as the file emitted in the resulting `image-input:change` event.
     */
    setImage (blob:Blob, name?:string):void {
        const file = this.#setFile(blob, name)
        this.#emit('change', { file, alt: this.#getAlt() })
    }

    #setFile (file:File|Blob, name?:string):File {
        const asFile = toFile(file, name, this.#file?.name)

        this.#revokePreviewUrl()
        this.#file = asFile
        this.#previewUrl = URL.createObjectURL(asFile)

        const img = this.#qs<HTMLImageElement>('img')
        if (img) img.src = this.#previewUrl
        this.#qs('.preview')?.classList.add('has-image')
        this.#qs('.box')?.classList.add('has-image')

        return asFile
    }

    /**
     * Clear the selected file and reset the preview back to its empty
     * state.
     */
    clear ():void {
        this.#revokePreviewUrl()
        this.#file = null

        const input = this.#qs<HTMLInputElement>('input')
        if (input) input.value = ''

        this.#qs('img')?.removeAttribute('src')
        this.#qs('.preview')?.classList.remove('has-image')
        this.#qs('.box')?.classList.remove('has-image')

        this.#resetAlt()
    }

    #revokePreviewUrl ():void {
        if (this.#previewUrl) {
            URL.revokeObjectURL(this.#previewUrl)
            this.#previewUrl = null
        }
    }
}
