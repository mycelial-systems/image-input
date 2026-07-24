import { WebComponent } from '@substrate-system/web-component'
import { createDebug } from '@substrate-system/debug'
import { html } from './html.js'
import { ImageInputClient } from './client.js'
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

    #client:ImageInputClient|null = null

    connectedCallback () {
        debug('connected')
        super.connectedCallback()
        this.#client = new ImageInputClient(this, {
            emit: (type, detail) => this.emit(type, { detail }),
            getAlt: () => this.alt ?? '',
            resetAlt: () => { this.alt = null }
        })
    }

    disconnectedCallback () {
        debug('disconnected')
        this.#client?.destroy()
        this.#client = null
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

    /**
     * Replace the preview on the given instance with a Blob (e.g. a
     * cropped or dropped image), and use it as the file emitted in the
     * resulting `image-input:change` event.
     */
    static setImage (instance:ImageInput, blob:Blob):void {
        instance.#client?.setImage(blob)
    }

    /**
     * Replace the preview with a Blob (e.g. a cropped image), and use it
     * as the file emitted in the resulting `image-input:change` event.
     */
    setImage (blob:Blob):void {
        ImageInput.setImage(this, blob)
    }

    render () {
        this.innerHTML = html({
            accept: this.accept,
            name: this.name,
            required: this.required,
            alt: this.alt
        })
    }
}

ImageInput.define()
