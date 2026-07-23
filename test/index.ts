import { test } from '@substrate-system/tapzero'
import { waitFor } from '@substrate-system/dom'
import '../src/index.js'
import type { ImageInput } from '../src/index.js'
import './crop.js'
import './crop-math.js'

test('example test', async t => {
    document.body.innerHTML += `
        <image-input class="test">
        </image-input>
    `

    const el = await waitFor('image-input')

    t.ok(el, 'should find an element')
})

function selectFile (el:ImageInput, file:File):void {
    const input = el.querySelector('input[type="file"]') as HTMLInputElement
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    input.files = dataTransfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
}

test('preview with overlay controls', async t => {
    document.body.innerHTML += `
        <image-input class="overlay-test"></image-input>
    `
    const el = await waitFor('image-input.overlay-test') as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })

    selectFile(el, file)

    const preview = el.querySelector('.preview')
    t.ok(preview?.classList.contains('has-image'),
        'should show the preview once a file is selected')

    const img = el.querySelector('img')
    t.ok(img?.getAttribute('src'), 'should set the preview image src')

    const altBadge = el.querySelector('.alt-badge')
    const editBtn = el.querySelector('.edit')
    const removeBtn = el.querySelector('.remove')

    t.ok(altBadge?.getAttribute('aria-label'),
        'ALT badge should have an accessible name')
    t.ok(editBtn?.getAttribute('aria-label'),
        'edit button should have an accessible name')
    t.ok(removeBtn?.getAttribute('aria-label'),
        'remove button should have an accessible name')

    t.equal(editBtn?.getAttribute('tabindex'), null,
        'buttons should be natively focusable, not opted out via tabindex')
})

test('alt property toggles the badge state', async t => {
    document.body.innerHTML += `
        <image-input class="alt-test"></image-input>
    `
    const el = await waitFor('image-input.alt-test') as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })
    selectFile(el, file)

    const badge = el.querySelector('.alt-badge')
    t.equal(badge?.classList.contains('has-alt'), false,
        'badge should not have has-alt before alt text is set')

    el.alt = 'a description'

    t.ok(badge?.classList.contains('has-alt'),
        'badge should have has-alt once alt text is set')

    const img = el.querySelector('img')
    t.equal(img?.getAttribute('alt'), 'a description',
        'should set the alt attribute on the preview image')
})

test('remove clears state and emits an event', async t => {
    document.body.innerHTML += `
        <image-input class="remove-test"></image-input>
    `
    const el = await waitFor('image-input.remove-test') as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })
    selectFile(el, file)
    el.alt = 'a description'

    let removeEventDetail:unknown = 'not called'
    el.addEventListener('image-input:remove', (ev:Event) => {
        removeEventDetail = (ev as CustomEvent).detail
    })

    const removeBtn = el.querySelector('.remove') as HTMLButtonElement
    removeBtn.click()

    t.equal(removeEventDetail, undefined,
        'should emit an image-input:remove event')

    const preview = el.querySelector('.preview')
    t.equal(preview?.classList.contains('has-image'), false,
        'should hide the preview after remove')

    const img = el.querySelector('img')
    t.equal(img?.getAttribute('src'), null,
        'should clear the preview image src after remove')

    t.equal(el.alt, null, 'should clear the alt text after remove')

    const input = el.querySelector('input[type="file"]') as HTMLInputElement
    t.equal(input.value, '', 'should clear the file input after remove')
})

test('edit button emits image-input:edit with the file', async t => {
    document.body.innerHTML += `
        <image-input class="edit-test"></image-input>
    `
    const el = await waitFor('image-input.edit-test') as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })
    selectFile(el, file)

    let detail:unknown = 'not called'
    let bubbled = false
    document.body.addEventListener('image-input:edit', (ev:Event) => {
        detail = (ev as CustomEvent).detail
        bubbled = true
    })

    const editBtn = el.querySelector('.edit') as HTMLButtonElement
    editBtn.click()

    t.ok(bubbled, 'the event should bubble up to an ancestor')
    t.equal((detail as { file:File }).file, file,
        'should emit image-input:edit with the current file')
})

test('ALT badge emits image-input:alt with the file and alt text', async t => {
    document.body.innerHTML += `
        <image-input class="alt-event-test"></image-input>
    `
    const el = await waitFor('image-input.alt-event-test') as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })
    selectFile(el, file)

    let detail:{ file:File, alt:string }|undefined
    document.body.addEventListener('image-input:alt', (ev:Event) => {
        detail = (ev as CustomEvent).detail
    })

    const altBadge = el.querySelector('.alt-badge') as HTMLButtonElement
    altBadge.click()

    t.equal(detail?.file, file,
        'should emit image-input:alt with the current file')
    t.equal(detail?.alt, '',
        'should emit an empty alt string when none has been set yet')

    el.alt = 'a description'
    altBadge.click()

    t.equal(detail?.alt, 'a description',
        'should emit the current alt text once set')
})

test('change event detail includes the current alt text', async t => {
    document.body.innerHTML += `
        <image-input class="change-alt-test"></image-input>
    `
    const el = await waitFor('image-input.change-alt-test') as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })

    let detail:{ file:File, alt:string }|undefined
    el.addEventListener('image-input:change', (ev:Event) => {
        detail = (ev as CustomEvent).detail
    })

    selectFile(el, file)

    t.equal(detail?.file, file,
        'should emit image-input:change with the selected file')
    t.equal(detail?.alt, '',
        'should emit an empty alt string when none has been set yet')

    el.alt = 'a description'
    const secondFile = new File(['def'], 'photo2.png', { type: 'image/png' })
    selectFile(el, secondFile)

    t.equal(detail?.alt, 'a description',
        'should emit the current alt text once set')
})

test('setImage replaces the preview with the given blob', async t => {
    document.body.innerHTML += `
        <image-input class="set-image-test"></image-input>
    `
    const el = await waitFor('image-input.set-image-test') as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })
    selectFile(el, file)

    const imgBefore = el.querySelector('img') as HTMLImageElement
    const srcBefore = imgBefore.getAttribute('src')

    const blob = new Blob(['cropped'], { type: 'image/jpeg' })

    let detail:{ file:Blob, alt:string }|undefined
    el.addEventListener('image-input:change', (ev:Event) => {
        detail = (ev as CustomEvent).detail
    })

    el.setImage(blob)

    const preview = el.querySelector('.preview')
    t.ok(preview?.classList.contains('has-image'),
        'should keep showing the preview after setImage')

    const imgAfter = el.querySelector('img') as HTMLImageElement
    t.ok(imgAfter.getAttribute('src'), 'should set a new preview src')
    t.notEqual(imgAfter.getAttribute('src'), srcBefore,
        'should replace the previous preview src')

    t.equal(detail?.file, blob,
        'should emit image-input:change with the new blob as the file')
})

test('setImage revokes the previous preview object URL', async t => {
    document.body.innerHTML += `
        <image-input class="set-image-revoke-test"></image-input>
    `
    const el = await waitFor('image-input.set-image-revoke-test') as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })
    selectFile(el, file)

    const revoked:string[] = []
    const original = URL.revokeObjectURL
    URL.revokeObjectURL = (url:string) => {
        revoked.push(url)
        return original.call(URL, url)
    }

    const imgBefore = el.querySelector('img') as HTMLImageElement
    const srcBefore = imgBefore.getAttribute('src') as string

    const blob = new Blob(['cropped'], { type: 'image/jpeg' })
    el.setImage(blob)

    URL.revokeObjectURL = original

    t.ok(revoked.includes(srcBefore),
        'should revoke the previous preview object URL')
})

test('edit and alt buttons do not open a dialog or navigate', async t => {
    document.body.innerHTML += `
        <image-input class="no-dialog-test"></image-input>
    `
    const el = await waitFor('image-input.no-dialog-test') as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })
    selectFile(el, file)

    const editBtn = el.querySelector('.edit') as HTMLButtonElement
    const altBadge = el.querySelector('.alt-badge') as HTMLButtonElement

    t.equal(el.querySelector('dialog'), null,
        'should not have a dialog element before clicking')

    editBtn.click()
    altBadge.click()

    t.equal(el.querySelector('dialog'), null,
        'should not open a dialog after clicking edit or alt buttons')
})
