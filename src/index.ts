import { WebComponent } from '@substrate-system/web-component'
import { createDebug } from '@substrate-system/debug'
import { dragDrop, type DropRecord } from '@substrate-system/drag-drop'
import {
    openDialog,
    closeDialog,
    DEFAULT_TEXT,
    type DialogText
} from './dialogs.js'
import { html, DEFAULT_LABEL as LABEL } from './html.js'
import { ImageCrop } from './crop.js'
import {
    EXT,
    toFile,
    storedSrc,
    inputRequired,
    encodableType,
    guessType,
    cropName
} from './file.js'
// The type-only import is enough to pull `events.d.ts` into a
// consumer's program, which is what activates its `declare global`
// augmentation of `HTMLElementEventMap`. No runtime import needed --
// events.ts emits no JS.
import type {
    ImageInputEventMap,
    ChangeSource,
    ErrorReason
} from './events.js'
const debug = createDebug('image-input')

export type { ImageInputEventMap, ChangeSource, ErrorReason }

/**
 * `<image-crop>` is a first-class element (ADR-002): the reusable
 * part of the old crop dialog -- the rect, the constraint, the
 * pointer and keyboard interaction, and canvas encoding -- rather
 * than an implementation detail of `<image-input>`. The root module
 * already imports it above for its own use, so re-exporting adds no
 * weight, and it saves a consumer from having to know the `/crop`
 * subpath exists.
 */
export { ImageCrop }
export type {
    CropRect,
    GetBlobOptions,
    ImageCropEventMap
} from './crop.js'

// for document.querySelector
declare global {
    interface HTMLElementTagNameMap {
        'image-input': ImageInput
    }
}

export class ImageInput extends WebComponent {
    static TAG = 'image-input'
    TAG = ImageInput.TAG
    static reflectedStringAttributes = [
        'accept', 'name', 'alt', 'label', 'crop', 'src', 'crossorigin'
    ]

    static reflectedBooleanAttributes = ['required', 'nocrop']
    declare accept:string|null
    declare name:string|null
    declare alt:string|null
    declare label:string|null
    declare crop:string|null
    declare src:string|null
    declare crossorigin:string|null
    declare required:boolean
    declare nocrop:boolean

    static DEFAULT_LABEL = LABEL

    static TEXT:DialogText = { ...DEFAULT_TEXT }

    /**
     * The MIME-type-to-extension map shared with `src/file.ts`. This
     * is the same object `deriveName` reads, not a copy -- mutate it
     * in place (e.g. `ImageInput.EXT['image/heic'] = 'heic'`) to add
     * or change an extension. Reassigning this property entirely
     * (`ImageInput.EXT = {...}`) does not change `deriveName`'s
     * behavior, since it still closes over the original module
     * binding.
     */
    static EXT:Record<string, string> = EXT

    #file:File|null = null
    #previewUrl:string|null = null
    #cleanupDrop:(() => void)|null = null
    #cropInFlight = false
    #connectedOnce = false

    /**
     * The open crop session, if any. `type` and `src` are fixed when the
     * dialog opens, so a `src` change while it is open cannot mix one
     * image's type with another's name.
     */
    #edit:{
        promise:Promise<File|null>
        resolve:(file:File|null) => void
        onClose:() => void
        src:string|null
        type:string|undefined
    }|null = null

    /**
     * Listen for a (non-namespaced) `image-input` event, with the
     * `detail` typed from {@link ImageInputEventMap}.
     *
     * The `EventListenerObject` overload is not optional decoration:
     * the base class declares one, an implementation signature is not
     * part of a subclass's public type, and a single-overload `on`
     * here is therefore not assignable to the inherited member
     * (TS2416).
     */
    on<K extends keyof ImageInputEventMap> (
        evName:K,
        handler:(ev:ImageInputEventMap[K]) => any,
        options?:boolean|AddEventListenerOptions
    ):void

    on<K extends keyof ImageInputEventMap> (
        evName:K,
        handler:EventListenerObject,
        options?:boolean|AddEventListenerOptions
    ):void

    on (
        evName:string,
        handler:any,
        options?:boolean|AddEventListenerOptions
    ):void {
        super.on(evName, handler, options)
    }

    off<K extends keyof ImageInputEventMap> (
        evName:K,
        handler:(ev:ImageInputEventMap[K]) => any,
        options?:boolean|EventListenerOptions
    ):void

    off<K extends keyof ImageInputEventMap> (
        evName:K,
        handler:EventListenerObject,
        options?:boolean|EventListenerOptions
    ):void

    off (
        evName:string,
        handler:any,
        options?:boolean|EventListenerOptions
    ):void {
        super.off(evName, handler, options)
    }

    connectedCallback () {
        debug('connected')
        super.connectedCallback()
        this.setupEventListeners()
        this.#connectedOnce = true
    }

    disconnectedCallback () {
        debug('disconnected')
        this.qs('input')?.removeEventListener('change', this.handleFileSelect)
        this.qs('.remove')?.removeEventListener('click', this.handleRemove)
        this.qs('.edit')?.removeEventListener('click', this.handleEdit)
        this.qs('.alt-badge')?.removeEventListener('click', this.handleAlt)
        this.qs('.alt-save')
            ?.removeEventListener('click', this.handleAltSave)
        this.qs('.alt-cancel')
            ?.removeEventListener('click', this.handleAltCancel)
        this.qs('.crop-save')
            ?.removeEventListener('click', this.handleCropSave)
        this.qs('.crop-cancel')
            ?.removeEventListener('click', this.handleCropCancel)
        this.#cleanupDrop?.()
        this.#revokePreviewUrl()
        this.#settleEdit(null)
    }

    setupEventListeners () {
        this.qs('input')?.addEventListener('change', this.handleFileSelect)
        this.qs('.remove')?.addEventListener('click', this.handleRemove)
        this.qs('.edit')?.addEventListener('click', this.handleEdit)
        this.qs('.alt-badge')?.addEventListener('click', this.handleAlt)
        this.qs('.alt-save')?.addEventListener('click', this.handleAltSave)
        this.qs('.alt-cancel')
            ?.addEventListener('click', this.handleAltCancel)
        this.qs('.crop-save')
            ?.addEventListener('click', this.handleCropSave)
        this.qs('.crop-cancel')
            ?.addEventListener('click', this.handleCropCancel)

        const box = this.qs<HTMLElement>('.box')
        if (box) this.#cleanupDrop = dragDrop(box, this.handleDrop)
    }

    handleChange_accept (_old:string|null, newValue:string|null) {
        this.qs('input')?.setAttribute('accept', newValue ?? 'image/*')
    }

    handleChange_name (_old:string|null, newValue:string|null) {
        const input = this.qs('input')
        if (!input) return
        if (newValue === null) {
            input.removeAttribute('name')
        } else {
            input.setAttribute('name', newValue)
        }
    }

    handleChange_required () {
        this.#syncView()
    }

    handleChange_label (_old:string|null, newValue:string|null) {
        const text = newValue ?? ImageInput.DEFAULT_LABEL

        const promptText = this.qs('.prompt-text')
        if (promptText) promptText.textContent = text

        this.qs('input')?.setAttribute('aria-label', text)
    }

    /**
     * A non-empty `src` replaces any held file, silently: a stored
     * image is never announced with `change`. An empty or removed `src`
     * leaves a held file alone.
     */
    handleChange_src (_old:string|null, newValue:string|null) {
        if (storedSrc(newValue) !== null) this.#dropFile()
        this.#syncView()
    }

    handleChange_crossorigin () {
        this.#syncView()
    }

    handleChange_alt (_old:string|null, newValue:string|null) {
        const img = this.qs('img')
        img?.setAttribute('alt', newValue ?? '')

        const badge = this.qs('.alt-badge')
        if (badge) {
            const hasAlt = !!newValue
            badge.classList.toggle('has-alt', hasAlt)
            badge.setAttribute('aria-label',
                (hasAlt ? 'Edit alt text' : 'Add alt text'))
        }

        // An alt present at parse time (or set before the element is
        // connected) is initial state, not a change.
        if (this.#connectedOnce) {
            this.emit('alt-change', { detail: { alt: newValue ?? '' } })
        }
    }

    handleFileSelect = (event:Event) => {
        const input = event.target as HTMLInputElement
        const file = input.files?.[0]

        if (!file) return

        if (file.type.startsWith('image/')) {
            debug('Image file selected:', file.name)
            this.#setFile(file, 'pick')
        } else {
            this.emit('error', { detail: { reason: 'not-an-image' } })
        }
    }

    handleRemove = (event:Event) => {
        event.preventDefault()
        this.clear()
        this.emit('remove')
    }

    handleEdit = (event:Event) => {
        event.preventDefault()
        this.edit()
    }

    handleAlt = (event:Event) => {
        event.preventDefault()
        if (!this.#hasImage()) return
        const notCanceled = this.emit('alt', {
            detail: {
                file: this.#file,
                src: this.#file ? null : this.#storedSrc(),
                alt: this.alt ?? ''
            }
        })
        if (!notCanceled) return

        const dialog = this.qs<HTMLDialogElement>('.alt-dialog')
        const textarea = dialog?.querySelector('textarea')
        if (textarea) textarea.value = this.alt ?? ''
        if (dialog) openDialog(dialog)
    }

    handleAltSave = (event:Event) => {
        event.preventDefault()
        const dialog = this.qs<HTMLDialogElement>('.alt-dialog')
        const textarea = dialog?.querySelector('textarea')
        this.alt = textarea?.value ?? ''
        if (dialog) closeDialog(dialog)
    }

    handleAltCancel = (event:Event) => {
        event.preventDefault()
        const dialog = this.qs<HTMLDialogElement>('.alt-dialog')
        if (dialog) closeDialog(dialog)
    }

    handleCropSave = async (event:Event):Promise<void> => {
        event.preventDefault()
        const dialog = this.qs<HTMLDialogElement>('.crop-dialog')
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
            this.emit('error', { detail: { reason: 'crop-failed' } })
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

    handleCropCancel = (event:Event) => {
        event.preventDefault()
        this.#settleEdit(null)
        const dialog = this.qs<HTMLDialogElement>('.crop-dialog')
        if (dialog) closeDialog(dialog)
    }

    handleDrop = (record:DropRecord):void => {
        const files:File[] = Object.values(record)
        const file = files.find(f => f.type.startsWith('image/'))
        if (!file) {
            this.emit('error', { detail: { reason: 'not-an-image' } })
            return
        }

        debug('Image file dropped:', file.name)
        this.#setFile(file, 'drop')
    }

    /**
     * Replace the preview with a Blob (e.g. a cropped image), and use it
     * as the file emitted in the resulting `image-input:change` event.
     *
     * This is the implementation; the instance method delegates to it.
     * See the note above {@link ImageInput.clear}.
     */
    static setImage (el:ImageInput, blob:Blob, name?:string):void {
        el.#setFile(blob, 'api', name)
    }

    setImage (blob:Blob, name?:string):void {
        ImageInput.setImage(this, blob, name)
    }

    /**
     * Clear the selected file and remove the stored source, resetting
     * the preview back to its empty state. Does not emit
     * `image-input:remove` -- that event means the user clicked the
     * remove button. Setting `alt` to `null` here does emit
     * `image-input:alt-change` with an empty string.
     *
     * Every method meant to be called from outside the component is
     * written as a static taking the instance first, with a one-line
     * instance method delegating to it. The static is callable without
     * a `this` binding -- `el.querySelectorAll('image-input')
     * .forEach(ImageInput.clear)` and `promise.then(ImageInput.clear)`
     * both work -- and the instance form stays the natural way to call
     * it. Private fields are reachable here because a static method is
     * inside the class body.
     */
    static clear (el:ImageInput):void {
        el.#dropFile()
        el.removeAttribute('src')
        el.#syncView()
        el.alt = null
    }

    clear ():void {
        ImageInput.clear(this)
    }

    /**
     * Open the crop step. Resolves with the cropped File after Save
     * (after `change` with `source:'crop'` has been emitted), or with
     * null when the dialog closes without saving. Resolves null at once
     * under `nocrop`, with no image, or when a listener cancels `edit`.
     * While the dialog is open, returns the pending promise.
     */
    static edit (el:ImageInput):Promise<File|null> {
        const dialog = el.qs<HTMLDialogElement>('.crop-dialog')
        if (el.#edit) {
            // Reuse the session only while its dialog is open. `close` is
            // queued as a task, so code that closes the dialog and calls
            // edit() in the same tick must end the old session here and
            // open a new one.
            if (dialog?.open) return el.#edit.promise
            el.#settleEdit(null)
        }
        // Even though CSS hides .edit when nocrop is set, scripted clicks and
        // pages without our stylesheet can invoke this, so the guard is essential
        // (FDR-003).
        if (el.nocrop || !el.#hasImage()) return Promise.resolve(null)

        const file = el.#file
        const src = file ? null : el.#storedSrc()
        const notCanceled = el.emit('edit', { detail: { file, src } })
        if (!notCanceled) return Promise.resolve(null)

        const cropEl = el.#getOrCreateCropEl()
        if (!dialog || !cropEl) return Promise.resolve(null)

        if (el.crop == null) {
            cropEl.removeAttribute('crop')
        } else {
            cropEl.setAttribute('crop', el.crop)
        }
        if (file) {
            cropEl.setFile(file)
        } else if (src !== null) {
            // crossorigin before src, so the cropper's load and the
            // preview's load use one CORS mode
            cropEl.crossorigin = el.crossorigin
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
            el.#settleEdit(null)
        }
        el.#edit = {
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

    edit ():Promise<File|null> {
        return ImageInput.edit(this)
    }

    #settleEdit (file:File|null):void {
        const pending = this.#edit
        if (!pending) return
        this.#edit = null
        this.qs('.crop-dialog')?.removeEventListener('close', pending.onClose)
        pending.resolve(file)
    }

    /**
     * Reuse the `.crop-slot`'s `<image-crop>` if one has already been
     * created, otherwise create it lazily. Rendering it eagerly for
     * every `image-input` would mean idle window listeners (see
     * `ImageCrop.connectedCallback`) on pages where nobody crops.
     */
    #getOrCreateCropEl ():ImageCrop|null {
        const slot = this.qs<HTMLElement>('.crop-slot')
        if (!slot) return null

        let cropEl = slot.querySelector<ImageCrop>(ImageCrop.TAG)
        if (!cropEl) {
            cropEl = document.createElement(ImageCrop.TAG) as ImageCrop
            slot.appendChild(cropEl)
        }
        return cropEl
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
        this.#previewUrl = URL.createObjectURL(asFile)
        // The file replaces a stored image. #file is already set, so
        // handleChange_src keeps it.
        this.removeAttribute('src')
        this.#syncView()

        this.emit('change', {
            detail: { file: asFile, alt: this.alt ?? '', source }
        })
        return asFile
    }

    #syncInputFiles (file:File):void {
        const input = this.qs<HTMLInputElement>('input')
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

    #revokePreviewUrl ():void {
        if (this.#previewUrl) {
            URL.revokeObjectURL(this.#previewUrl)
            this.#previewUrl = null
        }
    }

    /** The stored URL being shown, or null. '' counts as none. */
    #storedSrc ():string|null {
        return storedSrc(this.src)
    }

    #hasImage ():boolean {
        return !!this.#file || this.#storedSrc() !== null
    }

    /** Forget the held file without touching `src`. */
    #dropFile ():void {
        this.#revokePreviewUrl()
        this.#file = null
        const input = this.qs<HTMLInputElement>('input')
        if (input) input.value = ''
    }

    /**
     * Re-derive everything visible from state: the preview img
     * (crossorigin first, so both loads share one CORS mode), the
     * has-image classes, and the input's `required`. Every transition
     * ends here. A no-op before the first render.
     */
    #syncView ():void {
        const src = this.#previewUrl ?? this.#storedSrc()
        const img = this.qs<HTMLImageElement>('.preview img')
        if (img) {
            if (this.crossorigin == null) {
                img.removeAttribute('crossorigin')
            } else {
                img.setAttribute('crossorigin', this.crossorigin)
            }
            if (src === null) {
                img.removeAttribute('src')
            } else if (img.getAttribute('src') !== src) {
                img.setAttribute('src', src)
            }
        }

        const hasImage = src !== null
        this.qs('.preview')?.classList.toggle('has-image', hasImage)
        this.qs('.box')?.classList.toggle('has-image', hasImage)

        const input = this.qs<HTMLInputElement>('input')
        if (input) {
            // keep the markup agreeing with html(): intent in
            // data-required, the effective rule in required
            input.toggleAttribute('data-required', this.required)
            input.required = inputRequired(
                this.required,
                this.#storedSrc() !== null
            )
        }
    }

    render () {
        this.innerHTML = html({
            accept: this.accept,
            name: this.name,
            required: this.required,
            alt: this.alt,
            label: this.label ?? ImageInput.DEFAULT_LABEL,
            text: ImageInput.TEXT,
            src: this.#storedSrc(),
            crossorigin: this.crossorigin
        })
    }
}

ImageInput.define()
