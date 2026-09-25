import { createDebug } from '@substrate-system/debug'
import {
    toFile,
    storedSrc,
    inputRequired,
    encodableType,
    guessType,
    cropName
} from './file.js'
import { openDialog, closeDialog } from './dialogs.js'
import { ImageCrop } from './crop.js'
import type { ChangeSource } from './events.js'
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
 *
 * For server-rendered markup from `html({src})`, use `setSrc()` to
 * display a stored image. `edit()` opens the crop dialog for either
 * picked files or stored images, returning the cropped file or null.
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
    #storedSrc:string|null = null
    #renderedCrossorigin:string|null = null
    #edit:{
        promise:Promise<File|null>
        resolve:(file:File|null) => void
        onClose:() => void
        src:string|null
        type:string|undefined
    }|null = null

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

        const img = this.#qs<HTMLImageElement>('.preview img')
        this.#storedSrc = storedSrc(img?.getAttribute('src'))
        this.#renderedCrossorigin = img?.getAttribute('crossorigin') ?? null

        this.#setup()
    }

    #qs<T extends Element = Element> (selector:string):T|null {
        return this.host.querySelector<T>(selector)
    }

    /**
     * From the host, or else as the preview img was rendered. Not read
     * live from the img, since #syncView writes it: a host value, once
     * applied, could never be cleared.
     */
    #crossorigin ():string|null {
        return this.host.getAttribute('crossorigin') ??
            this.#renderedCrossorigin
    }

    #hasImage ():boolean {
        return !!this.#file || this.#storedSrc !== null
    }

    #dropFile ():void {
        this.#revokePreviewUrl()
        this.#file = null
        const input = this.#qs<HTMLInputElement>('input')
        if (input) input.value = ''
    }

    #syncView ():void {
        const src = this.#previewUrl ?? this.#storedSrc
        const img = this.#qs<HTMLImageElement>('.preview img')
        if (img) {
            const crossorigin = this.#crossorigin()
            if (crossorigin == null) {
                img.removeAttribute('crossorigin')
            } else {
                img.setAttribute('crossorigin', crossorigin)
            }
            if (src === null) {
                img.removeAttribute('src')
            } else if (img.getAttribute('src') !== src) {
                img.setAttribute('src', src)
            }
        }
        const hasImage = src !== null
        this.#qs('.preview')?.classList.toggle('has-image', hasImage)
        this.#qs('.box')?.classList.toggle('has-image', hasImage)

        const input = this.#qs<HTMLInputElement>('input')
        if (input) {
            input.required = inputRequired(
                input.dataset.required !== undefined,
                this.#storedSrc !== null
            )
        }
    }

    #settleEdit (file:File|null):void {
        const pending = this.#edit
        if (!pending) return
        this.#edit = null
        this.#qs('.crop-dialog')
            ?.removeEventListener('close', pending.onClose)
        pending.resolve(file)
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
     * disconnects its crop child too. Also settles a pending edit() with
     * null, so a caller awaiting edit() is not left hanging.
     */
    destroy ():void {
        debug('destroy')
        this.#settleEdit(null)
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

        if (!file) return

        if (file.type.startsWith('image/')) {
            debug('Image file selected:', file.name)
            this.#setFile(file, 'pick')
        } else {
            this.#emit('error', { reason: 'not-an-image' })
        }
    }

    #handleRemove = (event:Event) => {
        event.preventDefault()
        this.clear()
        this.#emit('remove')
    }

    #handleEdit = (event:Event) => {
        event.preventDefault()
        this.edit()
    }

    #handleAlt = (event:Event) => {
        event.preventDefault()
        if (!this.#hasImage()) return
        const notCanceled = this.#emit('alt', {
            file: this.#file,
            src: this.#file ? null : this.#storedSrc,
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
        // still running would otherwise apply the crop twice, or apply
        // it to a dialog the user has already dismissed. If Save is
        // clicked in a different session, this guard silently drops it.
        if (this.#cropInFlight) return
        this.#cropInFlight = true

        const pending = this.#edit
        let blob:Blob
        try {
            blob = await cropEl.getBlob({ type: pending?.type })
        } catch (err) {
            // Not decoded yet, or a tainted canvas (a cross-origin image
            // loaded without CORS). Leave the dialog open, the image
            // untouched, and edit() pending.
            debug('crop save failed', err)
            this.#emit('error', { reason: 'crop-failed' })
            return
        } finally {
            this.#cropInFlight = false
        }

        // The dialog closing during the await means the user canceled. A
        // changed session means that one was canceled and a new edit()
        // opened meanwhile -- this blob belongs to neither.
        if (this.#edit !== pending || (dialog && !dialog.open)) return

        const name = pending?.src ?
            cropName(pending.src, blob.type) :
            undefined
        const file = this.#setFile(blob, 'crop', name)
        this.#settleEdit(file)
        if (dialog) closeDialog(dialog)
    }

    #handleCropCancel = (event:Event) => {
        event.preventDefault()
        this.#settleEdit(null)
        const dialog = this.#qs<HTMLDialogElement>('.crop-dialog')
        if (dialog) closeDialog(dialog)
    }

    /**
     * Replace the preview with a Blob (e.g. a cropped image), and use it
     * as the file emitted in the resulting `image-input:change` event.
     */
    setImage (blob:Blob, name?:string):void {
        this.#setFile(blob, 'api', name)
    }

    /**
     * Show a stored image URL, or clear it with null (or ''). A non-empty
     * URL drops any held file. No event is emitted, and nothing is
     * fetched.
     */
    setSrc (url:string|null):void {
        const src = storedSrc(url)
        if (src !== null) this.#dropFile()
        this.#storedSrc = src
        this.#syncView()
    }

    /**
     * Open the crop step. Resolves with the cropped File after Save
     * (after `change` with `source:'crop'` has been emitted), or with
     * null when the dialog closes without saving. Resolves null at once
     * under `nocrop`, with no image, or when a listener cancels `edit`.
     * While the dialog is open, returns the pending promise.
     */
    edit ():Promise<File|null> {
        const dialog = this.#qs<HTMLDialogElement>('.crop-dialog')
        if (this.#edit) {
            // Reuse the session only while its dialog is open. `close` is
            // queued as a task, so code that closes the dialog and calls
            // edit() in the same tick must end the old session here and
            // open a new one.
            if (dialog?.open) return this.#edit.promise
            this.#settleEdit(null)
        }
        // Even though CSS hides .edit when nocrop is set, scripted clicks
        // and pages without our stylesheet can invoke this, so the guard
        // is essential (FDR-003).
        if (this.host.hasAttribute('nocrop') || !this.#hasImage()) {
            return Promise.resolve(null)
        }

        const file = this.#file
        const src = file ? null : this.#storedSrc
        const notCanceled = this.#emit('edit', { file, src })
        if (!notCanceled) return Promise.resolve(null)

        const cropEl = this.#getOrCreateCropEl()
        if (!dialog || !cropEl) return Promise.resolve(null)

        const crop = this.host.getAttribute('crop')
        if (crop === null) {
            cropEl.removeAttribute('crop')
        } else {
            cropEl.setAttribute('crop', crop)
        }
        if (file) {
            cropEl.setFile(file)
        } else if (src !== null) {
            // crossorigin before src, so the cropper's load and the
            // preview's load use one CORS mode
            cropEl.crossorigin = this.#crossorigin()
            cropEl.src = src
        }

        let resolve:(file:File|null) => void = () => {}
        const promise = new Promise<File|null>(_resolve => {
            resolve = _resolve
        })
        const onClose = () => {
            // a close queued by an earlier session can land after this
            // one reopened the dialog
            if (dialog.open) return
            this.#settleEdit(null)
        }
        this.#edit = {
            promise,
            resolve,
            onClose,
            src,
            type: src === null ? undefined : encodableType(guessType(src))
        }
        dialog.addEventListener('close', onClose)
        openDialog(dialog)
        return promise
    }

    #setFile (
        file:File|Blob,
        source:ChangeSource,
        name?:string
    ):File {
        const asFile = toFile(file, name, this.#file?.name)

        this.#syncInputFiles(asFile)
        this.#revokePreviewUrl()
        this.#file = asFile
        this.#storedSrc = null
        this.#previewUrl = URL.createObjectURL(asFile)
        this.#syncView()

        this.#emit('change', {
            file: asFile,
            alt: this.#getAlt(),
            source
        })

        return asFile
    }

    #syncInputFiles (file:File):void {
        const input = this.#qs<HTMLInputElement>('input')
        if (!input) return

        try {
            const dt = new DataTransfer()
            dt.items.add(file)
            input.files = dt.files
        } catch (_err) {
            // DataTransfer is not constructible everywhere; the change
            // event still carries the file.
        }
    }

    /**
     * Clear the selected file and reset the preview back to its empty
     * state.
     */
    clear ():void {
        this.#dropFile()
        this.#storedSrc = null
        this.#syncView()
        this.#resetAlt()
    }

    #revokePreviewUrl ():void {
        if (this.#previewUrl) {
            URL.revokeObjectURL(this.#previewUrl)
            this.#previewUrl = null
        }
    }
}
