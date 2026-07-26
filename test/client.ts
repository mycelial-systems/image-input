import { test } from '@substrate-system/tapzero'
import { html } from '../src/html.js'
import { ImageInputClient } from '../src/client.js'

/**
 * Mount markup from `html()` and attach a client to it.
 *
 * The host is a plain `<div>`, deliberately, not an `<image-input>`.
 * This bundle imports `../src/index.js`, so `image-input` is a
 * defined custom element here: appending one would upgrade it, and
 * its `connectedCallback` would call `render()` and replace the very
 * markup we just mounted, leaving two sets of handlers on it. The
 * two paths are mutually exclusive by design -- a page uses the
 * custom element or the static path, never both. A real
 * server-rendered page loads `client.js` and never defines
 * `image-input`, so it can use the tag as its host and pick up the
 * stylesheet. See the README's "Server rendering" section.
 */
export function mount (className:string):{
    host:HTMLElement,
    client:ImageInputClient
} {
    const host = document.createElement('div')
    host.className = className
    host.innerHTML = html()
    document.body.appendChild(host)
    return { host, client: new ImageInputClient(host) }
}

export function selectFile (host:HTMLElement, file:File):void {
    const input = host.querySelector(
        'input[type="file"]'
    ) as HTMLInputElement
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    input.files = dataTransfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
}

test('picking a file marks both the box and the preview', async t => {
    const { host } = mount('client-has-image-test')
    const box = host.querySelector('.box') as HTMLElement
    const preview = host.querySelector('.preview') as HTMLElement

    t.equal(box.classList.contains('has-image'), false,
        'the box should start without has-image')

    selectFile(host, new File(['abc'], 'photo.png', {
        type: 'image/png'
    }))

    t.equal(preview.classList.contains('has-image'), true,
        'the preview should gain has-image')
    t.equal(box.classList.contains('has-image'), true,
        'the box should gain has-image too')
})

test('clear() removes has-image from both', async t => {
    const { host, client } = mount('client-clear-test')
    const box = host.querySelector('.box') as HTMLElement
    const preview = host.querySelector('.preview') as HTMLElement

    selectFile(host, new File(['abc'], 'photo.png', {
        type: 'image/png'
    }))
    client.clear()

    t.equal(preview.classList.contains('has-image'), false,
        'the preview should lose has-image')
    t.equal(box.classList.contains('has-image'), false,
        'the box should lose has-image')
})
