import { WebComponent } from '@substrate-system/web-component'
import { createDebug } from '@substrate-system/debug'
import { dragDrop, type DropRecord } from '@substrate-system/drag-drop'
import {
    altDialogMarkup,
    cropDialogMarkup,
    openDialog,
    closeDialog,
    type DialogText
} from './dialogs.js'
import { ImageCrop } from './crop.js'
const debug = createDebug('image-input')

// for document.querySelector
declare global {
    interface HTMLElementTagNameMap {
        'image-input': ImageInput
    }
}

export class ImageInput extends WebComponent {
    static TAG = 'image-input'
    TAG = ImageInput.TAG
    static reflectedStringAttributes = ['accept', 'name', 'alt', 'label']
    static reflectedBooleanAttributes = ['required']
    declare accept:string|null
    declare name:string|null
    declare alt:string|null
    declare label:string|null
    declare required:boolean

    static DEFAULT_LABEL = 'Drop an image, or click to choose one'

    static TEXT:DialogText = {
        altHeading: 'Alt text',
        altLabel: 'Description',
        cropHeading: 'Crop image',
        save: 'Save',
        cancel: 'Cancel'
    }

    static EXT:Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'image/avif': 'avif'
    }

    #file:File|null = null
    #previewUrl:string|null = null
    #cleanupDrop:(() => void)|null = null

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
        this.#clear()
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

        const blob = await cropEl.getBlob()
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
     */
    setImage (blob:Blob, name?:string):void {
        const file = this.#setFile(blob, name)
        this.emit('change', { detail: { file, alt: this.alt ?? '' } })
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

    #deriveName (type:string):string {
        const prevName = this.#file?.name
        const base = prevName ?
            prevName.replace(/\.[^.]+$/, '') :
            'image'
        const ext = ImageInput.EXT[type] ?? 'jpg'
        return `${base}.${ext}`
    }

    #setFile (file:File|Blob, name?:string):File {
        const asFile = (file instanceof File && !name) ?
            file :
            new File([file], name ?? this.#deriveName(file.type), {
                type: file.type
            })

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

    #clear ():void {
        this.#revokePreviewUrl()
        this.#file = null

        const input = this.qs('input')
        if (input) input.value = ''

        this.qs('img')?.removeAttribute('src')
        this.qs('.preview')?.classList.remove('has-image')
        this.qs('.box')?.classList.remove('has-image')

        this.alt = null
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
        const accept = this.accept ?? 'image/*'
        const name = this.name ? ` name="${this.name}"` : ''
        const required = this.required ? ' required' : ''
        const alt = this.alt ?? ''
        const hasAlt = !!this.alt
        const label = this.label ?? ImageInput.DEFAULT_LABEL

        this.innerHTML = `<div class="box">
            <label class="picker">
                <input
                    type="file"
                    accept="${accept}"${name}${required}
                    aria-label="${label}"
                />
                <span class="prompt">
                    <svg class="prompt-icon" aria-hidden="true"
                        viewBox="0 0 24 24"
                    >
                        <path d="M12 16V4M12 4l-5 5M12 4l5 5" />
                        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0
                            0 1-1v-3" />
                    </svg>
                    <span class="prompt-text">${label}</span>
                </span>
            </label>
            <div class="preview">
                <img alt="${alt}" />
                <div class="overlay">
                    <button
                        type="button"
                        class="alt-badge${hasAlt ? ' has-alt' : ''}"
                        aria-label="${hasAlt ? 'Edit alt text' : 'Add alt text'}"
                    ><span class="plus" aria-hidden="true">+</span>ALT</button>
                    <div class="controls">
                        <button type="button" class="edit"
                            aria-label="Edit image"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0
                                    -3-3L5 17v3z" />
                            </svg>
                        </button>
                        <button type="button" class="remove"
                            aria-label="Remove image"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M5 5l14 14M19 5L5 19" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        ${altDialogMarkup(ImageInput.TEXT)}
        ${cropDialogMarkup(ImageInput.TEXT)}`
    }
}

ImageInput.define()
