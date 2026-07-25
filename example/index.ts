import '../src/index.css'
import './index.css'
import { render } from 'preact'
import { html } from 'htm/preact'
import { ImageInput } from '../src/index.js'
import { Panel } from './panel.js'

function App () {
    return html`
        <${ImageInput.TAG} accept="image/*" />
        <${Panel} />
    `
}

render(html`<${App} />`, document.getElementById('app') as HTMLElement)
