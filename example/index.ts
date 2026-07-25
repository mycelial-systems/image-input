import '../src/index.css'
import './index.css'
import { render } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { signal } from '@preact/signals'
import { html } from 'htm/preact'
import { dragDrop } from '@substrate-system/drag-drop'
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
