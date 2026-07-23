import { WebComponent } from '@substrate-system/web-component'
import { createDebug } from '@substrate-system/debug'
const debug = createDebug('image-input')

// for document.querySelector
declare global {
    interface HTMLElementTagNameMap {
        'image-input': ImageInput
    }
}

export class ImageInput extends WebComponent {
    static TAG = 'image-input'
    static reflectedStringAttributes = ['accept', 'name']
    static reflectedBooleanAttributes = ['required']
    declare accept:string|null
    declare name:string|null
    declare required:boolean

    connectedCallback () {
        debug('connected')
        super.connectedCallback()
        this.setupEventListeners()
    }

    disconnectedCallback () {
        debug('disconnected')
        this.qs('input')?.removeEventListener('change', this.handleFileSelect)
    }

    setupEventListeners () {
        this.qs('input')?.addEventListener('change', this.handleFileSelect)
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

    handleFileSelect = (event:Event) => {
        const input = event.target as HTMLInputElement
        const file = input.files?.[0]

        if (file && file.type.startsWith('image/')) {
            debug('Image file selected:', file.name)
            this.emit('change', { detail: { file } })
            const reader = new FileReader()

            reader.onload = (e) => {
                const result = e.target?.result as string
                const img = this.qs('img')
                if (img) {
                    img.src = result
                    img.style.display = 'block'
                }
            }

            reader.readAsDataURL(file)
        }
    }

    render () {
        const accept = this.accept ?? 'image/*'
        const name = this.name ? ` name="${this.name}"` : ''
        const required = this.required ? ' required' : ''

        this.innerHTML = `<div>
            <input
                type="file"
                accept="${accept}"${name}${required}
            />
            <img
                id="preview"
                style="display: none; max-width: 100%; margin-top: 1rem;"
            />
        </div>`
    }
}

ImageInput.define()
