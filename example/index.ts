import '../src/index.css'
import './index.css'
import { render } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { html } from 'htm/preact'
import { ImageInput } from '../src/index.js'
import { Panel } from './panel.js'
import {
    handleChange,
    handleAltChange,
    handleRemove,
    handleError,
    handleEdit,
    handleAlt,
} from './state.js'

function App () {
    const ref = useRef<ImageInput>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        el.addEventListener('image-input:change', handleChange)
        el.addEventListener('image-input:alt-change', handleAltChange)
        el.addEventListener('image-input:remove', handleRemove)
        el.addEventListener('image-input:error', handleError)
        el.addEventListener('image-input:edit', handleEdit)
        el.addEventListener('image-input:alt', handleAlt)

        return () => {
            el.removeEventListener('image-input:change', handleChange)
            el.removeEventListener('image-input:alt-change', handleAltChange)
            el.removeEventListener('image-input:remove', handleRemove)
            el.removeEventListener('image-input:error', handleError)
            el.removeEventListener('image-input:edit', handleEdit)
            el.removeEventListener('image-input:alt', handleAlt)
        }
    }, [])

    return html`
        <${ImageInput.TAG} ref=${ref} accept="image/*" />
        <${Panel} />
    `
}

render(html`<${App} />`, document.getElementById('app') as HTMLElement)
