import { test } from '@substrate-system/tapzero'
import { html } from '../src/html.js'
import { ImageInputClient } from '../src/client.js'
import type { ImageCrop } from '../src/crop.js'
import {
    makeImageFile,
    waitForCropRect
} from './helpers.js'

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

test('setImage promotes a Blob to a File on the client', async t => {
    const { host, client } = mount('client-promote-test')
    selectFile(host, new File(['abc'], 'photo.png', {
        type: 'image/png'
    }))

    let seen:unknown = null
    host.addEventListener('image-input:change', ev => {
        seen = (ev as CustomEvent).detail.file
    })

    client.setImage(new Blob(['xyz'], { type: 'image/jpeg' }))

    t.ok(seen instanceof File,
        'the change detail should carry a File, not a bare Blob')
    t.equal((seen as File).name, 'photo.jpg',
        'should keep the base name and swap the extension')
})

test('the ALT badge opens the alt dialog, seeded with the alt text',
    async t => {
        const { host } = mount('client-alt-open-test')
        selectFile(host, new File(['abc'], 'photo.png', {
            type: 'image/png'
        }))

        const badge = host.querySelector('.alt-badge') as HTMLElement
        const dialog = host.querySelector(
            '.alt-dialog'
        ) as HTMLDialogElement
        const textarea = dialog.querySelector(
            'textarea'
        ) as HTMLTextAreaElement

        t.equal(dialog.open, false,
            'the dialog should start closed')

        badge.click()

        t.equal(dialog.open, true,
            'clicking the badge should open the alt dialog')
        t.equal(textarea.value, '',
            'the textarea should be seeded with the current alt text')
    })

test('saving alt text updates the image and emits alt-change',
    async t => {
        const { host } = mount('client-alt-save-test')
        selectFile(host, new File(['abc'], 'photo.png', {
            type: 'image/png'
        }))

        let emitted:string|null = null
        host.addEventListener('image-input:alt-change', ev => {
            emitted = (ev as CustomEvent).detail.alt
        })

        const badge = host.querySelector('.alt-badge') as HTMLElement
        const dialog = host.querySelector(
            '.alt-dialog'
        ) as HTMLDialogElement
        const textarea = dialog.querySelector(
            'textarea'
        ) as HTMLTextAreaElement

        badge.click()
        textarea.value = 'a red square'
        ;(host.querySelector('.alt-save') as HTMLElement).click()

        const img = host.querySelector('img') as HTMLImageElement
        t.equal(dialog.open, false, 'saving should close the dialog')
        t.equal(img.getAttribute('alt'), 'a red square',
            'saving should write the alt text onto the img')
        t.equal(badge.classList.contains('has-alt'), true,
            'saving should mark the badge')
        t.equal(emitted, 'a red square',
            'saving should emit alt-change')
    })

test('canceling the alt dialog leaves the alt text alone', async t => {
    const { host } = mount('client-alt-cancel-test')
    selectFile(host, new File(['abc'], 'photo.png', {
        type: 'image/png'
    }))

    const badge = host.querySelector('.alt-badge') as HTMLElement
    const dialog = host.querySelector(
        '.alt-dialog'
    ) as HTMLDialogElement
    const textarea = dialog.querySelector(
        'textarea'
    ) as HTMLTextAreaElement

    badge.click()
    textarea.value = 'discard me'
    ;(host.querySelector('.alt-cancel') as HTMLElement).click()

    const img = host.querySelector('img') as HTMLImageElement
    t.equal(dialog.open, false, 'cancel should close the dialog')
    t.equal(img.getAttribute('alt'), '',
        'cancel should not write the alt text')
})

test('canceling image-input:alt suppresses the built-in dialog',
    async t => {
        const { host } = mount('client-alt-optout-test')
        selectFile(host, new File(['abc'], 'photo.png', {
            type: 'image/png'
        }))

        host.addEventListener('image-input:alt', ev => {
            ev.preventDefault()
        })

        const badge = host.querySelector('.alt-badge') as HTMLElement
        const dialog = host.querySelector(
            '.alt-dialog'
        ) as HTMLDialogElement

        badge.click()

        t.equal(dialog.open, false,
            'the dialog should stay closed when the event is canceled')
    })

test('the edit button lazily creates an image-crop and opens the ' +
    'crop dialog', async t => {
    const { host } = mount('client-crop-open-test')
    selectFile(host, new File(['abc'], 'photo.png', {
        type: 'image/png'
    }))

    const editBtn = host.querySelector('.edit') as HTMLButtonElement
    const dialog = host.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement

    t.equal(host.querySelector('image-crop'), null,
        'no image-crop should exist before the first edit click')

    editBtn.click()

    t.equal(dialog.open, true,
        'clicking edit should open the crop dialog')
    t.equal(host.querySelectorAll('image-crop').length, 1,
        'exactly one image-crop should be created')

    editBtn.click()
    t.equal(host.querySelectorAll('image-crop').length, 1,
        'reopening should reuse it, not append a second')
})

test('the edit button forwards the host\'s crop attribute to the ' +
    'lazily created image-crop', async t => {
    const { host } = mount('client-crop-forward-test')
    host.setAttribute('crop', 'circle')
    selectFile(host, new File(['abc'], 'photo.png', { type: 'image/png' }))

    ;(host.querySelector('.edit') as HTMLElement).click()

    const cropEl = host.querySelector('image-crop') as ImageCrop
    t.equal(cropEl.getAttribute('crop'), 'circle',
        'the crop attribute should be forwarded onto the image-crop')
})

test('destroy() removes the lazily created image-crop from the DOM',
    async t => {
        const { host, client } = mount('client-destroy-crop-test')
        selectFile(host, new File(['abc'], 'photo.png', {
            type: 'image/png'
        }))

        ;(host.querySelector('.edit') as HTMLElement).click()

        t.ok(host.querySelector('image-crop'),
            'sanity check: image-crop was created')

        client.destroy()

        t.equal(host.querySelector('image-crop'), null,
            'image-crop should be removed from the DOM after destroy()')
    })

test('saving the crop replaces the image and closes the dialog',
    async t => {
        const { host } = mount('client-crop-save-test')
        const file = await makeImageFile(100, 80)
        selectFile(host, file)

        ;(host.querySelector('.edit') as HTMLElement).click()

        const cropEl = host.querySelector('image-crop') as ImageCrop
        await waitForCropRect(cropEl, 100)

        // Register before clicking Save so there is no window in
        // which the event could fire before we are listening.
        const changed = new Promise<File>(resolve => {
            host.addEventListener('image-input:change', ev => {
                resolve((ev as CustomEvent).detail.file)
            }, { once: true })
        })

        ;(host.querySelector('.crop-save') as HTMLElement).click()
        const changedFile = await changed

        const dialog = host.querySelector(
            '.crop-dialog'
        ) as HTMLDialogElement
        t.equal(dialog.open, false, 'saving should close the dialog')
        t.ok(changedFile instanceof File,
            'saving should emit a change carrying a File')
    })

test('canceling the crop dialog leaves the image alone', async t => {
    const { host } = mount('client-crop-cancel-test')
    const file = await makeImageFile(60, 60)
    selectFile(host, file)

    const img = host.querySelector('img') as HTMLImageElement
    const before = img.src

    ;(host.querySelector('.edit') as HTMLElement).click()
    ;(host.querySelector('.crop-cancel') as HTMLElement).click()

    const dialog = host.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement
    t.equal(dialog.open, false, 'cancel should close the dialog')
    t.equal(img.src, before, 'cancel should leave the preview alone')
})
