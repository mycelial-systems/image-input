import { define } from '@substrate-system/web-component/util'
import { createDebug } from '@substrate-system/debug'
const debug = createDebug('image-input')

// for docuement.querySelector
declare global {
    interface HTMLElementTagNameMap {
        'image-input': ImageInput
    }
}

export class ImageInput extends HTMLElement {
    private fileInput:HTMLInputElement|null = null
    private previewImg:HTMLImageElement|null = null

    disconnectedCallback () {
        debug('disconnected')
        if (this.fileInput) {
            this.fileInput.removeEventListener('change', this.handleFileSelect)
        }
    }

    connectedCallback () {
        debug('connected')
        this.render()
        this.setupEventListeners()
    }

    setupEventListeners () {
        this.fileInput = this.querySelector('input[type="file"]')
        this.previewImg = this.querySelector('#preview')

        if (this.fileInput) {
            this.fileInput.addEventListener('change', this.handleFileSelect)
        }
    }

    handleFileSelect = (event:Event) => {
        const input = event.target as HTMLInputElement
        const file = input.files?.[0]

        if (file && file.type.startsWith('image/')) {
            debug('Image file selected:', file.name)
            const reader = new FileReader()

            reader.onload = (e) => {
                const result = e.target?.result as string
                if (this.previewImg) {
                    this.previewImg.src = result
                    this.previewImg.style.display = 'block'
                }
            }

            reader.readAsDataURL(file)
        }
    }

    render () {
        this.innerHTML = `<div>
            <input type="file" accept="image/*" />
            <img id="preview" style="display: none; max-width: 100%; margin-top: 1rem;" />
        </div>`
    }
}

define('image-input', ImageInput)
