import { test } from '@substrate-system/tapzero'
import { html, type ImageInputHtmlOptions } from '../src/html.js'
import { ImageInputClient } from '../src/client.js'
import type { ImageCrop } from '../src/crop.js'
import type {
    ImageInputEventMap
} from '../src/events.js'
import {
    makeImageFile,
    waitForCropRect,
    waitForImageLoad
} from './helpers.js'
import { imageBlob, imageFile } from './fixture.js'

// Sentinel for race conditions with timeouts
const TIMEOUT = Symbol('timeout')

// Helper to race a promise against a timeout
async function raceWithTimeout<T> (
    promise:Promise<T>,
    ms:number = 200
):Promise<T|typeof TIMEOUT> {
    return Promise.race([
        promise,
        new Promise<typeof TIMEOUT>(_resolve => {
            setTimeout(() => _resolve(TIMEOUT), ms)
        })
    ])
}

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
export function mount (
    className:string,
    opts?:ImageInputHtmlOptions
):{
    host:HTMLElement,
    client:ImageInputClient
} {
    const host = document.createElement('div')
    host.className = className
    host.innerHTML = html(opts)
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

    selectFile(host, imageFile('photo.png', 'image/png'))

    t.equal(preview.classList.contains('has-image'), true,
        'the preview should gain has-image')
    t.equal(box.classList.contains('has-image'), true,
        'the box should gain has-image too')
})

test('clear() removes has-image from both', async t => {
    const { host, client } = mount('client-clear-test')
    const box = host.querySelector('.box') as HTMLElement
    const preview = host.querySelector('.preview') as HTMLElement

    selectFile(host, imageFile('photo.png', 'image/png'))
    client.clear()

    t.equal(preview.classList.contains('has-image'), false,
        'the preview should lose has-image')
    t.equal(box.classList.contains('has-image'), false,
        'the box should lose has-image')
})

test('setImage promotes a Blob to a File on the client', async t => {
    const { host, client } = mount('client-promote-test')
    selectFile(host, imageFile('photo.png', 'image/png'))

    let seen = null as File|null
    host.addEventListener('image-input:change', ev => {
        seen = ev.detail.file
    })

    client.setImage(imageBlob())

    t.ok(seen instanceof File,
        'the change detail should carry a File, not a bare Blob')
    t.equal(seen?.name, 'photo.jpg',
        'should keep the base name and swap the extension')
})

test('the ALT badge opens the alt dialog, seeded with the alt text',
    async t => {
        const { host } = mount('client-alt-open-test')
        selectFile(host, imageFile('photo.png', 'image/png'))

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
        selectFile(host, imageFile('photo.png', 'image/png'))

        let emitted = null as string|null
        host.addEventListener('image-input:alt-change', ev => {
            emitted = ev.detail.alt
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
    selectFile(host, imageFile('photo.png', 'image/png'))

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
        selectFile(host, imageFile('photo.png', 'image/png'))

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
    selectFile(host, imageFile('photo.png', 'image/png'))

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
    selectFile(host, imageFile('photo.png', 'image/png'))

    ;(host.querySelector('.edit') as HTMLElement).click()

    const cropEl = host.querySelector('image-crop') as ImageCrop
    t.equal(cropEl.getAttribute('crop'), 'circle',
        'the crop attribute should be forwarded onto the image-crop')
})

test('destroy() removes the lazily created image-crop from the DOM',
    async t => {
        const { host, client } = mount('client-destroy-crop-test')
        selectFile(host, imageFile('photo.png', 'image/png'))

        ;(host.querySelector('.edit') as HTMLElement).click()

        t.ok(host.querySelector('image-crop'),
            'sanity check: image-crop was created')

        client.destroy()

        t.equal(host.querySelector('image-crop'), null,
            'image-crop should be removed from the DOM after destroy()')
    })

test('nocrop on the host makes the edit button inert in the static ' +
    'markup path too', async t => {
    const { host } = mount('client-nocrop-test')
    host.setAttribute('nocrop', '')
    selectFile(host, imageFile('photo.png', 'image/png'))

    let editCount = 0
    host.addEventListener('image-input:edit', () => { editCount++ })

    ;(host.querySelector('.edit') as HTMLElement).click()

    const dialog = host.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement
    t.equal(editCount, 0,
        'image-input:edit should not fire while the host has nocrop')
    t.equal(dialog.open, false,
        'the crop dialog should stay closed')
    t.equal(host.querySelector('image-crop'), null,
        'no image-crop should be created')

    host.removeAttribute('nocrop')
    ;(host.querySelector('.edit') as HTMLElement).click()

    t.equal(editCount, 1,
        'removing the attribute should make the trigger work again')
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
                resolve(ev.detail.file)
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

test('AC7.3: mounting with src shows the image and ALT opens dialog ' +
    'with correct detail', async t => {
    const { host } = mount('client-stored-src-test',
        { src: '/fixtures/photo.png' })

    const box = host.querySelector('.box') as HTMLElement
    const preview = host.querySelector('.preview') as HTMLElement
    t.equal(box.classList.contains('has-image'), true,
        'the box should have has-image')
    t.equal(preview.classList.contains('has-image'), true,
        'the preview should have has-image')

    let altDetail = null as ImageInputEventMap['alt']['detail']|null
    host.addEventListener('image-input:alt', ev => {
        altDetail = ev.detail
    })

    ;(host.querySelector('.alt-badge') as HTMLElement).click()

    const dialog = host.querySelector(
        '.alt-dialog'
    ) as HTMLDialogElement
    t.equal(dialog.open, true, 'alt badge should open the dialog')
    t.deepEqual(
        altDetail,
        { file: null, src: '/fixtures/photo.png', alt: '' },
        'should emit alt detail with file:null, src, and empty alt'
    )

    ;(host.querySelector('.alt-cancel') as HTMLElement).click()
})

test('AC7.4: setSrc() with a URL drops any held file and shows the ' +
    'image, emitting no events', async t => {
    const { host, client } = mount('client-setsrc-drop-test')
    selectFile(host, imageFile('photo.png', 'image/png'))

    const events:string[] = []
    host.addEventListener('image-input:change', () => {
        events.push('change')
    })
    host.addEventListener('image-input:remove', () => {
        events.push('remove')
    })
    host.addEventListener('image-input:alt-change', () => {
        events.push('alt-change')
    })

    client.setSrc('/fixtures/photo.png')

    const input = host.querySelector('input') as HTMLInputElement
    t.equal(input.files?.length, 0, 'should clear input.files')

    const img = host.querySelector('img') as HTMLImageElement
    t.equal(img.getAttribute('src'), '/fixtures/photo.png',
        'should set the preview src to the URL')

    t.deepEqual(events, [], 'should emit no events')
})

test('AC7.4: setSrc(null) removes has-image and clears the preview',
    async t => {
        const { host, client } = mount('client-setsrc-null-test',
            { src: '/fixtures/photo.png' })

        const box = host.querySelector('.box') as HTMLElement
        const img = host.querySelector('img') as HTMLImageElement

        t.equal(box.classList.contains('has-image'), true,
            'sanity: should start with has-image')

        client.setSrc(null)

        t.equal(box.classList.contains('has-image'), false,
            'should remove has-image')
        t.ok(!img.hasAttribute('src') || img.getAttribute('src') === '',
            'should clear the img src')
    })

test('AC7.4: setSrc("") behaves like null', async t => {
    const { host, client } = mount('client-setsrc-empty-test',
        { src: '/fixtures/photo.png' })

    const box = host.querySelector('.box') as HTMLElement

    client.setSrc('')

    t.equal(box.classList.contains('has-image'), false,
        'empty string should remove has-image like null')
})

test('AC7.5: edit() on a picked file resolves the cropped File after ' +
    'change emits with source:crop', async t => {
    const { host, client } = mount('client-edit-crop-test')
    const file = await makeImageFile(200, 100)
    selectFile(host, file)

    let changeDetail = null as ImageInputEventMap['change']['detail']|null
    host.addEventListener('image-input:change', ev => {
        changeDetail = ev.detail
    })

    const p = client.edit()

    const cropEl = host.querySelector('image-crop') as ImageCrop
    await waitForImageLoad(cropEl)

    ;(host.querySelector('.crop-save') as HTMLElement).click()

    const result = await raceWithTimeout(p)

    t.ok(result instanceof File, 'should resolve a File')
    t.ok(result === changeDetail?.file,
        'resolved file should be the same object as change detail')

    const changeSource = changeDetail?.source ?? null
    t.equal(changeSource, 'crop',
        'should emit change with source:crop')
})

test('AC7.5: edit() on stored src emits edit with correct detail and ' +
    'Save gives a file with correct name', async t => {
    const { host, client } = mount('client-edit-src-test',
        { src: '/fixtures/photo.png' })

    let editDetail = null as ImageInputEventMap['edit']['detail']|null
    host.addEventListener('image-input:edit', ev => {
        editDetail = ev.detail
    })

    const p = client.edit()

    t.deepEqual(
        editDetail,
        { file: null, src: '/fixtures/photo.png' },
        'should emit edit with file:null and src'
    )

    const cropEl = host.querySelector('image-crop') as ImageCrop
    await waitForImageLoad(cropEl)

    let changeFile = null as File|null
    host.addEventListener('image-input:change', ev => {
        changeFile = ev.detail.file
    })

    ;(host.querySelector('.crop-save') as HTMLElement).click()

    const result = await raceWithTimeout(p)

    t.ok(result !== TIMEOUT, 'edit should resolve')
    t.ok(result === changeFile, 'resolved file should match change detail')
    t.equal(changeFile?.name, 'photo.png',
        'should derive name from the URL path')
    t.equal(changeFile?.type, 'image/png',
        'should set type from the guessed extension')
})

test('AC7.5: edit() cancel resolves null', async t => {
    const { host, client } = mount('client-edit-cancel-test')
    selectFile(host, imageFile('photo.png', 'image/png'))

    const p = client.edit()

    ;(host.querySelector('.crop-cancel') as HTMLElement).click()

    const result = await raceWithTimeout(p)
    t.ok(result === null, 'should resolve null')
})

test('AC7.5: edit() Esc path (dialog.close()) resolves null', async t => {
    const { host, client } = mount('client-edit-esc-test')
    selectFile(host, imageFile('photo.png', 'image/png'))

    const p = client.edit()

    const dialog = host.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement

    dialog.close()
    await new Promise(_resolve => setTimeout(_resolve, 0))

    const result = await raceWithTimeout(p)
    t.ok(result === null, 'should resolve null')
})

test('AC7.5: close then edit in one tick', async t => {
    const { host, client } = mount('client-close-edit-tick-test')
    selectFile(host, imageFile('photo.png', 'image/png'))

    const dialog = host.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement

    const a = client.edit()

    const staleClose = new Promise(_resolve => dialog
        .addEventListener('close', _resolve, { once: true }))

    dialog.close()
    const b = client.edit()

    t.notEqual(a, b, 'should have two distinct promises')
    t.equal(dialog.open, true, 'dialog should reopen')

    let settled = false
    b.then(() => { settled = true })

    await staleClose
    await new Promise(_resolve => setTimeout(_resolve, 0))

    t.ok(settled === false, 'b should still be pending after stale close')
    t.equal(dialog.open, true,
        'the reopened dialog should stay open after the stale close')

    ;(host.querySelector('.crop-cancel') as HTMLElement).click()

    const resultA = await raceWithTimeout(a)
    const resultB = await raceWithTimeout(b)
    t.ok(resultA === null, 'a should resolve null')
    t.ok(resultB === null, 'b should resolve null')
})

test('AC7.5: nocrop, no image, or canceled edit() resolves null',
    async t => {
        const { host, client } = mount('client-edit-null-test')
        host.setAttribute('nocrop', '')

        const p1 = client.edit()
        const r1 = await raceWithTimeout(p1)
        t.ok(r1 === null, 'nocrop should resolve null immediately')

        const dialog = host.querySelector(
            '.crop-dialog'
        ) as HTMLDialogElement
        t.equal(dialog.open, false, 'dialog should stay closed')

        host.removeAttribute('nocrop')
        selectFile(host, imageFile('photo.png', 'image/png'))

        host.addEventListener('image-input:edit', ev => {
            ev.preventDefault()
        })

        const p2 = client.edit()
        const r2 = await raceWithTimeout(p2)
        t.ok(r2 === null, 'canceled edit should resolve null')
    })

test('AC7.5: edit() on no image resolves null and does not create ' +
    'crop dialog or element', async t => {
    const { host, client } = mount('client-edit-no-image-test')

    let editCount = 0
    host.addEventListener('image-input:edit', () => {
        editCount++
    })

    const p = client.edit()
    const result = await raceWithTimeout(p)

    t.ok(result === null, 'should resolve null')
    t.equal(editCount, 0, 'should not emit edit event')

    const dialog = host.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement|null
    if (dialog) {
        t.equal(dialog.open, false, 'dialog should stay closed')
    }

    const cropEl = host.querySelector('image-crop')
    t.equal(cropEl, null, 'no image-crop should be created')
})

test('AC7.5: calling edit() twice while open returns same promise and ' +
    'fires only one edit event', async t => {
    const { host, client } = mount('client-edit-twice-test')
    selectFile(host, imageFile('photo.png', 'image/png'))

    let editCount = 0
    host.addEventListener('image-input:edit', () => { editCount++ })

    const p1 = client.edit()
    const p2 = client.edit()

    t.ok(p1 === p2, 'should return the same promise')
    t.equal(editCount, 1, 'should fire only one edit event')

    const dialog = host.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement
    t.equal(dialog.open, true, 'dialog should stay open')

    ;(host.querySelector('.crop-cancel') as HTMLElement).click()
    const result = await raceWithTimeout(p1)
    t.ok(result === null, 'should resolve null')
})

test('destroy() while dialog is open resolves pending edit() with null',
    async t => {
        const { host, client } = mount('client-destroy-pending-test')
        selectFile(host, imageFile('photo.png', 'image/png'))

        const p = client.edit()

        const dialog = host.querySelector(
            '.crop-dialog'
        ) as HTMLDialogElement
        t.equal(dialog.open, true, 'dialog should be open')

        client.destroy()

        const result = await raceWithTimeout(p)
        t.ok(result === null, 'edit() should resolve null after destroy()')

        if (dialog) dialog.close()
    })

test('AC7.5: in-flight save across sessions', async t => {
    const { host, client } = mount('client-inflight-save-test')
    selectFile(host, imageFile('photo.png', 'image/png'))

    const a = client.edit()
    const dialog = host.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement
    const cropEl = host.querySelector('image-crop') as ImageCrop
    await waitForImageLoad(cropEl)

    let deferredResolve:(blob:Blob) => void = () => {}
    const deferred = new Promise<Blob>(_resolve => {
        deferredResolve = _resolve
    })

    try {
        cropEl.getBlob = () => deferred

        let changeCount = 0
        host.addEventListener('image-input:change', () => {
            changeCount++
        })

        ;(host.querySelector('.crop-save') as HTMLElement).click()

        dialog.close()

        const b = client.edit()
        t.ok(a !== b, 'new session should have a new promise')

        const blob = await imageBlob('image/png')
        deferredResolve(blob)

        await new Promise(_resolve => setTimeout(_resolve, 0))

        let aResolved:File|null|undefined
        a.then((result) => { aResolved = result })
        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.ok(aResolved === null, 'session a should resolve null')
        t.equal(changeCount, 0, 'no change should be emitted for stale blob')

        let bResolved = false
        b.then(() => { bResolved = true })
        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.ok(bResolved === false,
            'session b should still be pending after timeout')

        ;(host.querySelector('.crop-cancel') as HTMLElement).click()
        const result = await raceWithTimeout(b)

        t.ok(result === null, 'session b should resolve null')
    } finally {
        Reflect.deleteProperty(cropEl, 'getBlob')
    }
})

test('AC7.6: picking a non-image emits error', async t => {
    const { host } = mount('client-non-image-test')

    type ErrorReason = ImageInputEventMap['error']['detail']['reason']
    let errorReason = null as ErrorReason|null
    host.addEventListener('image-input:error', ev => {
        errorReason = ev.detail.reason
    })

    selectFile(host, new File(['x'], 'a.txt', { type: 'text/plain' }))

    t.equal(errorReason, 'not-an-image',
        'should emit error with not-an-image reason')
})

test('AC7.6: crop failure emits error and dialog stays open',
    async t => {
        const { host } = mount('client-crop-error-test')
        selectFile(host, imageFile('photo.png', 'image/png'))

        ;(host.querySelector('.edit') as HTMLElement).click()

        const cropEl = host.querySelector('image-crop') as ImageCrop
        await waitForImageLoad(cropEl)

        type ErrorReason = ImageInputEventMap['error']['detail']['reason']
        let errorReason = null as ErrorReason|null
        host.addEventListener('image-input:error', ev => {
            errorReason = ev.detail.reason
        })

        const dialog = host.querySelector(
            '.crop-dialog'
        ) as HTMLDialogElement

        try {
            cropEl.getBlob = () => {
                return Promise.reject(new Error('blob failed'))
            }

            ;(host.querySelector('.crop-save') as HTMLElement).click()

            await new Promise(_resolve => setTimeout(_resolve, 50))

            t.equal(errorReason, 'crop-failed',
                'should emit error with crop-failed reason')
            t.equal(dialog.open, true,
                'dialog should stay open on error')
        } finally {
            Reflect.deleteProperty(cropEl, 'getBlob')
            ;(host.querySelector('.crop-cancel') as HTMLElement).click()
        }
    })

test('AC7.6: rendering with required:true and src makes input.required ' +
    'false', async t => {
    const { host } = mount('client-required-stored-test',
        { required: true, src: '/fixtures/photo.png' })

    const input = host.querySelector('input') as HTMLInputElement
    t.equal(input.required, false,
        'input should not be required when stored image is present')
})

test('AC7.6: removing stored image makes input required again',
    async t => {
        const { host } = mount('client-required-remove-test',
            { required: true, src: '/fixtures/photo.png' })

        const input = host.querySelector('input') as HTMLInputElement
        t.equal(input.required, false, 'sanity: should start not required')

        ;(host.querySelector('.remove') as HTMLElement).click()

        t.equal(input.required, true,
            'should become required after remove')
    })

test('AC7.6: change from pick has source:pick, from setImage has ' +
    'source:api', async t => {
    const { host, client } = mount('client-change-source-test')

    const sources:unknown[] = []
    host.addEventListener('image-input:change', ev => {
        sources.push(ev.detail.source)
    })

    selectFile(host, imageFile('photo.png', 'image/png'))

    client.setImage(imageBlob())

    t.deepEqual(sources, ['pick', 'api'],
        'should emit correct source values')
})

test('AC7.6: setSrc changes input.required state based on stored image',
    async t => {
        const { host, client } = mount('client-required-setsrc-test',
            { required: true })

        const input = host.querySelector('input') as HTMLInputElement

        t.equal(input.required, true,
            'should be required initially (no image)')

        client.setSrc('/fixtures/photo.png')

        t.equal(input.required, false,
            'should not be required after setSrc (has stored image)')

        client.setSrc(null)

        t.equal(input.required, true,
            'should be required again after setSrc(null)')
    })

test('crossorigin from host is applied to preview img', async t => {
    const { host, client } = mount('client-crossorigin-test',
        { src: '/fixtures/photo.png' })
    host.setAttribute('crossorigin', 'anonymous')

    client.setSrc('/fixtures/photo.png')

    const img = host.querySelector('img') as HTMLImageElement
    t.equal(img.getAttribute('crossorigin'), 'anonymous',
        'preview img should have crossorigin attribute from host')
})

test('crossorigin fallback to rendered img without host attribute',
    async t => {
        const { host, client } = mount('client-crossorigin-fallback-test',
            { src: '/fixtures/photo.png', crossorigin: 'anonymous' })

        client.setSrc('/fixtures/photo.png')

        const img = host.querySelector('img') as HTMLImageElement
        t.equal(img.getAttribute('crossorigin'), 'anonymous',
            'preview img should retain crossorigin from rendered value')
    })

test('crossorigin host attribute overrides then falls back to rendered',
    async t => {
        const { host, client } = mount(
            'client-crossorigin-override-test',
            { src: '/fixtures/photo.png', crossorigin: 'use-credentials' })

        // First apply host attribute
        host.setAttribute('crossorigin', 'anonymous')
        client.setSrc('/fixtures/photo.png')

        let img = host.querySelector('img') as HTMLImageElement
        t.equal(img.getAttribute('crossorigin'), 'anonymous',
            'host attribute should override rendered value')

        // Then remove it and revert to rendered
        host.removeAttribute('crossorigin')
        client.setSrc('/fixtures/photo.png')

        img = host.querySelector('img') as HTMLImageElement
        t.equal(img.getAttribute('crossorigin'), 'use-credentials',
            'should fall back to rendered value when host removed')
    })

test('crossorigin applied to crop element on src-only edit()',
    async t => {
        const { host, client } = mount(
            'client-crossorigin-crop-test',
            { src: '/fixtures/photo.png' })
        host.setAttribute('crossorigin', 'anonymous')

        const p = client.edit()

        const cropEl = host.querySelector('image-crop')
        t.equal(cropEl?.getAttribute('crossorigin'), 'anonymous',
            'crop element should have crossorigin from host')

        ;(host.querySelector('.crop-cancel') as HTMLElement).click()
        const result = await raceWithTimeout(p)
        t.ok(result === null, 'should cancel edit')
    })

test('IMPORTANT 4: input.files and checkValidity after crop save ' +
    'with src image', async t => {
    const { host, client } = mount('client-input-files-src-test',
        { src: '/fixtures/photo.png', required: true })

    const input = host.querySelector('input') as HTMLInputElement
    t.ok(input, 'input should exist')

    const p = client.edit()

    const cropEl = host.querySelector('image-crop') as ImageCrop
    await waitForImageLoad(cropEl)

    ;(host.querySelector('.crop-save') as HTMLElement).click()

    const result = await raceWithTimeout(p)
    t.ok(result !== TIMEOUT, 'edit should resolve')

    t.ok(input.files?.length === 1,
        'input.files should contain one file after crop save')
    t.ok(input.checkValidity() === true,
        'input should be valid after file is set')
})

test('IMPORTANT 4: input.files and checkValidity after setImage ' +
    'with required', async t => {
    const { host, client } = mount('client-input-files-blob-test',
        { required: true })

    const input = host.querySelector('input') as HTMLInputElement
    t.ok(input, 'input should exist')

    const blob = await imageBlob('image/png')
    client.setImage(blob)

    t.ok(input.files?.length === 1,
        'input.files should contain one file after setImage')
    t.ok(input.checkValidity() === true,
        'input should be valid after file is set')
})
