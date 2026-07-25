import '../src/index.css'
import './index.css'
import { ImageInput } from '../src/index.js'

document.body.innerHTML += `
    <${ImageInput.TAG} id="input"></${ImageInput.TAG}>
    <div id="alt-display">The alt text: <span id="alt-value"></span></div>
`

const input = document.getElementById('input') as ImageInput
const altValue = document.getElementById('alt-value') as HTMLSpanElement

input.addEventListener('image-input:alt-change', ((e:CustomEvent) => {
    altValue.textContent = e.detail.alt
}) as EventListener)
