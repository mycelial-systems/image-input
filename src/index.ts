import { WebComponent } from '@substrate-system/web-component'
import { createDebug } from '@substrate-system/debug'
import { dragDrop, type DropRecord } from '@substrate-system/drag-drop'
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
    static reflectedStringAttributes = ['accept', 'name', 'alt']
    static reflectedBooleanAttributes = ['required']
    declare accept:string|null
    declare name:string|null
    declare alt:string|null
    declare required:boolean

    #file:File|Blob|null = null
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
        this.#cleanupDrop?.()
        this.#revokePreviewUrl()
    }

    setupEventListeners () {
        this.qs('input')?.addEventListener('change', this.handleFileSelect)
        this.qs('.remove')?.addEventListener('click', this.handleRemove)
        this.qs('.edit')?.addEventListener('click', this.handleEdit)
        this.qs('.alt-badge')?.addEventListener('click', this.handleAlt)

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

        if (file && file.type.startsWith('image/')) {
            debug('Image file selected:', file.name)
            this.#setFile(file)
            this.emit('change', { detail: { file, alt: this.alt ?? '' } })
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
        this.emit('edit', { detail: { file: this.#file } })
    }

    handleAlt = (event:Event) => {
        event.preventDefault()
        if (!this.#file) return
        this.emit('alt', { detail: { file: this.#file, alt: this.alt ?? '' } })
    }

    handleDrop = (record:DropRecord):void => {
        const files:File[] = Object.values(record)
        const file = files.find(f => f.type.startsWith('image/'))
        if (!file) return

        debug('Image file dropped:', file.name)
        this.#syncInputFiles(file)
        this.#setFile(file)
        this.emit('change', { detail: { file, alt: this.alt ?? '' } })
    }

    /**
     * Replace the preview with a Blob (e.g. a cropped image), and use it
     * as the file emitted in the resulting `image-input:change` event.
     */
    setImage (blob:Blob):void {
        this.#setFile(blob)
        this.emit('change', { detail: { file: blob, alt: this.alt ?? '' } })
    }

    #setFile (file:File|Blob):void {
        this.#revokePreviewUrl()
        this.#file = file
        this.#previewUrl = URL.createObjectURL(file)

        const img = this.qs('img')
        if (img) img.src = this.#previewUrl
        this.qs('.preview')?.classList.add('has-image')
        this.qs('.box')?.classList.add('has-image')
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

        this.innerHTML = `<div class="box">
            <label class="picker">
                <input
                    type="file"
                    accept="${accept}"${name}${required}
                />
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
        </div>`
    }
}

ImageInput.define()
