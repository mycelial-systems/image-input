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
import { EXT, toFile } from './file.js'
// The type-only import is enough to pull `events.d.ts` into a
// consumer's program, which is what activates its `declare global`
// augmentation of `HTMLElementEventMap`. No runtime import needed --
// events.ts emits no JS.
import type { ImageInputEventMap } from './events.js'
const debug = createDebug('image-input')

export type { ImageInputEventMap }

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
        'accept', 'name', 'alt', 'label', 'crop'
    ]

    static reflectedBooleanAttributes = ['required']
    declare accept:string|null
    declare name:string|null
    declare alt:string|null
    declare label:string|null
    declare crop:string|null
    declare required:boolean

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

    handleChange_required (_old:string|null, newValue:string|null) {
        this.qs('input')?.toggleAttribute('required', newValue !== null)
    }

    handleChange_label (_old:string|null, newValue:string|null) {
        const text = newValue ?? ImageInput.DEFAULT_LABEL

        const promptText = this.qs('.prompt-text')
        if (promptText) promptText.textContent = text

        this.qs('input')?.setAttribute('aria-label', text)
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

        this.emit('alt-change', { detail: { alt: newValue ?? '' } })
    }

    handleFileSelect = (event:Event) => {
        const input = event.target as HTMLInputElement
        const file = input.files?.[0]

        if (!file) return

        if (file.type.startsWith('image/')) {
            debug('Image file selected:', file.name)
            this.#setFile(file)
            this.emit('change', { detail: { file, alt: this.alt ?? '' } })
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
        if (!this.#file) return
        const notCanceled = this.emit('edit', {
            detail: { file: this.#file }
        })
        if (!notCanceled) return

        const dialog = this.qs<HTMLDialogElement>('.crop-dialog')
        const cropEl = this.#getOrCreateCropEl()
        // `ImageCrop` does not reflect `crop` as a property (it already
        // has a `.crop` getter for the current rect) -- forward the
        // attribute directly, every open, in case it changed since the
        // last one.
        if (cropEl) {
            if (this.crop == null) {
                cropEl.removeAttribute('crop')
            } else {
                cropEl.setAttribute('crop', this.crop)
            }
        }
        cropEl?.setFile(this.#file)
        if (dialog) openDialog(dialog)
    }

    handleAlt = (event:Event) => {
        event.preventDefault()
        if (!this.#file) return
        const notCanceled = this.emit('alt', {
            detail: { file: this.#file, alt: this.alt ?? '' }
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
        // it to a dialog the user has already dismissed.
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

    handleCropCancel = (event:Event) => {
        event.preventDefault()
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
        this.#setFile(file)
        this.emit('change', { detail: { file, alt: this.alt ?? '' } })
    }

    /**
     * Replace the preview with a Blob (e.g. a cropped image), and use it
     * as the file emitted in the resulting `image-input:change` event.
     *
     * This is the implementation; the instance method delegates to it.
     * See the note above {@link ImageInput.clear}.
     */
    static setImage (el:ImageInput, blob:Blob, name?:string):void {
        const file = el.#setFile(blob, name)
        el.emit('change', { detail: { file, alt: el.alt ?? '' } })
    }

    setImage (blob:Blob, name?:string):void {
        ImageInput.setImage(this, blob, name)
    }

    /**
     * Clear the selected file and reset the preview back to its empty
     * state. Does not emit `image-input:remove` -- that event means the
     * user clicked the remove button. Setting `alt` to `null` here does
     * emit `image-input:alt-change` with an empty string.
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
        el.#revokePreviewUrl()
        el.#file = null

        const input = el.qs('input')
        if (input) input.value = ''

        el.qs('img')?.removeAttribute('src')
        el.qs('.preview')?.classList.remove('has-image')
        el.qs('.box')?.classList.remove('has-image')

        el.alt = null
    }

    clear ():void {
        ImageInput.clear(this)
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

    #setFile (file:File|Blob, name?:string):File {
        const asFile = toFile(file, name, this.#file?.name)

        this.#syncInputFiles(asFile)
        this.#revokePreviewUrl()
        this.#file = asFile
        this.#previewUrl = URL.createObjectURL(asFile)

        const img = this.qs('img')
        if (img) img.src = this.#previewUrl
        this.qs('.preview')?.classList.add('has-image')
        this.qs('.box')?.classList.add('has-image')

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

    render () {
        this.innerHTML = html({
            accept: this.accept,
            name: this.name,
            required: this.required,
            alt: this.alt,
            label: this.label ?? ImageInput.DEFAULT_LABEL,
            text: ImageInput.TEXT
        })
    }
}

ImageInput.define()
