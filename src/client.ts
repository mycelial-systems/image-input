import { createDebug } from '@substrate-system/debug'
import { toFile } from './file.js'
import { openDialog, closeDialog } from './dialogs.js'
import { ImageCrop } from './crop.js'
const debug = createDebug('image-input:client')

export interface ImageInputClientOptions {
    /**
     * Emit a (non-namespaced) event, returning `false` when a listener
     * canceled it. Defaults to dispatching a bubbling, cancelable
     * `image-input:<type>` CustomEvent on the host element.
     */
    emit?:(type:string, detail?:unknown) => boolean;
    /**
     * Read the current alt text. Defaults to the preview image's `alt`
     * attribute.
     */
    getAlt?:() => string;
    /**
     * Write the alt text. Defaults to setting the preview image's
     * `alt`, updating the ALT badge, and emitting `alt-change`.
     */
    setAlt?:(alt:string) => void;
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
    #emit:(type:string, detail?:unknown) => boolean
    #getAlt:() => string
    #setAlt:(alt:string) => void
    #resetAlt:() => void
    #file:File|null = null
    #previewUrl:string|null = null
    #cropInFlight = false

    constructor (host:HTMLElement, opts:ImageInputClientOptions = {}) {
        this.host = host

        this.#emit = opts.emit ?? ((type, detail) => {
            return host.dispatchEvent(
                new CustomEvent(`image-input:${type}`, {
                    bubbles: true,
                    cancelable: true,
                    detail
                })
            )
        })

        this.#getAlt = opts.getAlt ?? (() => {
            const img = this.#qs<HTMLImageElement>('img')
            return img?.getAttribute('alt') ?? ''
        })

        this.#setAlt = opts.setAlt ?? ((alt:string) => {
            this.#qs('img')?.setAttribute('alt', alt)
            const badge = this.#qs('.alt-badge')
            if (badge) {
                const hasAlt = !!alt
                badge.classList.toggle('has-alt', hasAlt)
                badge.setAttribute(
                    'aria-label',
                    hasAlt ? 'Edit alt text' : 'Add alt text'
                )
            }
            this.#emit('alt-change', { alt })
        })

        this.#resetAlt = opts.resetAlt ?? (() => this.#setAlt(''))

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
        this.#qs('.alt-save')
            ?.addEventListener('click', this.#handleAltSave)
        this.#qs('.alt-cancel')
            ?.addEventListener('click', this.#handleAltCancel)
        this.#qs('.crop-save')
            ?.addEventListener('click', this.#handleCropSave)
        this.#qs('.crop-cancel')
            ?.addEventListener('click', this.#handleCropCancel)
    }

    /**
     * Remove all event listeners, revoke any outstanding preview URL,
     * and remove the lazily created `<image-crop>` (if any) from the
     * DOM. Without that last step, `ImageCrop.connectedCallback`'s
     * window listeners would outlive the client that created it --
     * the custom element avoids this for free, since disconnecting it
     * disconnects its crop child too.
     */
    destroy ():void {
        debug('destroy')
        this.#qs('input')
            ?.removeEventListener('change', this.#handleFileSelect)
        this.#qs('.remove')?.removeEventListener('click', this.#handleRemove)
        this.#qs('.edit')?.removeEventListener('click', this.#handleEdit)
        this.#qs('.alt-badge')?.removeEventListener('click', this.#handleAlt)
        this.#qs('.alt-save')
            ?.removeEventListener('click', this.#handleAltSave)
        this.#qs('.alt-cancel')
            ?.removeEventListener('click', this.#handleAltCancel)
        this.#qs('.crop-save')
            ?.removeEventListener('click', this.#handleCropSave)
        this.#qs('.crop-cancel')
            ?.removeEventListener('click', this.#handleCropCancel)
        this.#qs<ImageCrop>(ImageCrop.TAG)?.remove()
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
        const notCanceled = this.#emit('edit', { file: this.#file })
        if (!notCanceled) return

        const dialog = this.#qs<HTMLDialogElement>('.crop-dialog')
        const cropEl = this.#getOrCreateCropEl()
        // `ImageCrop` does not reflect `crop` as a property (it already
        // has a `.crop` getter for the current rect) -- forward the
        // host's attribute directly, every open, in case it changed
        // since the last one.
        if (cropEl) {
            const crop = this.host.getAttribute('crop')
            if (crop == null) {
                cropEl.removeAttribute('crop')
            } else {
                cropEl.setAttribute('crop', crop)
            }
        }
        cropEl?.setFile(this.#file)
        if (dialog) openDialog(dialog)
    }

    #handleAlt = (event:Event) => {
        event.preventDefault()
        if (!this.#file) return
        const notCanceled = this.#emit('alt', {
            file: this.#file,
            alt: this.#getAlt()
        })
        if (!notCanceled) return

        const dialog = this.#qs<HTMLDialogElement>('.alt-dialog')
        const textarea = dialog?.querySelector('textarea')
        if (textarea) textarea.value = this.#getAlt()
        if (dialog) openDialog(dialog)
    }

    #handleAltSave = (event:Event) => {
        event.preventDefault()
        const dialog = this.#qs<HTMLDialogElement>('.alt-dialog')
        const textarea = dialog?.querySelector('textarea')
        this.#setAlt(textarea?.value ?? '')
        if (dialog) closeDialog(dialog)
    }

    #handleAltCancel = (event:Event) => {
        event.preventDefault()
        const dialog = this.#qs<HTMLDialogElement>('.alt-dialog')
        if (dialog) closeDialog(dialog)
    }

    /**
     * Reuse the `.crop-slot`'s `<image-crop>` if one exists, otherwise
     * create it. Creating one eagerly for every mounted client would
     * mean idle window listeners (see `ImageCrop.connectedCallback`)
     * on pages where nobody ever crops.
     */
    #getOrCreateCropEl ():ImageCrop|null {
        const slot = this.#qs<HTMLElement>('.crop-slot')
        if (!slot) return null

        let cropEl = slot.querySelector<ImageCrop>(ImageCrop.TAG)
        if (!cropEl) {
            cropEl = document.createElement(ImageCrop.TAG) as ImageCrop
            slot.appendChild(cropEl)
        }
        return cropEl
    }

    #handleCropSave = async (event:Event):Promise<void> => {
        event.preventDefault()
        const dialog = this.#qs<HTMLDialogElement>('.crop-dialog')
        const cropEl = dialog?.querySelector<ImageCrop>(ImageCrop.TAG)
        if (!cropEl) return
        // A second Save click, or an Esc press, while getBlob() is
        // still running would otherwise apply the crop twice, or
        // apply it to a dialog the user already dismissed.
        if (this.#cropInFlight) return
        this.#cropInFlight = true

        let blob:Blob
        try {
            blob = await cropEl.getBlob()
        } catch (err) {
            // The image is not decoded yet, or the canvas refused to
            // produce a blob. Leave the dialog open and the current
            // image untouched.
            debug('crop save failed', err)
            return
        } finally {
            this.#cropInFlight = false
        }

        // The dialog closing during the await means the user canceled.
        if (dialog && !dialog.open) return

        this.setImage(blob)
        if (dialog) closeDialog(dialog)
    }

    #handleCropCancel = (event:Event) => {
        event.preventDefault()
        const dialog = this.#qs<HTMLDialogElement>('.crop-dialog')
        if (dialog) closeDialog(dialog)
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
