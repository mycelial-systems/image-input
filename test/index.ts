import { test } from '@substrate-system/tapzero'
import { waitFor } from '@substrate-system/dom'
import '../src/index.js'
import type { ImageInput } from '../src/index.js'
import './crop.js'
import './crop-math.js'

test('renders a .box div instead of .wrapper', async t => {
    document.body.innerHTML += `
        <image-input class="box-test" accept="image/png" name="photo"
            required></image-input>
    `
    const el = await waitFor('image-input.box-test') as ImageInput

    t.equal(el.querySelector('.wrapper'), null,
        'the .wrapper div should be gone')

    const box = el.querySelector('.box')
    t.ok(box, 'should render a .box div')

    const picker = el.querySelector('.picker')
    t.ok(picker, 'should render a .picker element inside the box')
    t.ok(box?.contains(picker as Node),
        'the .picker should be inside the .box')

    const preview = el.querySelector('.preview')
    t.ok(box?.contains(preview as Node),
        'the .preview subtree should still be inside the .box')
})

test('the native input keeps its attributes and stays in the picker',
    async t => {
        document.body.innerHTML += `
            <image-input class="input-attrs-test" accept="image/png"
                name="photo" required></image-input>
        `
        const el = await waitFor('image-input.input-attrs-test') as ImageInput

        const picker = el.querySelector('.picker')
        const input = el.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement

        t.ok(picker?.contains(input),
            'the input should still exist and be inside .picker')
        t.equal(input.getAttribute('accept'), 'image/png',
            'should keep the accept attribute')
        t.equal(input.getAttribute('name'), 'photo',
            'should keep the name attribute')
        t.equal(input.hasAttribute('required'), true,
            'should keep the required attribute')
    })

test('the input is not hidden with display:none or the hidden attribute',
    async t => {
        document.body.innerHTML += `
            <image-input class="input-visible-test"></image-input>
        `
        const el = await waitFor(
            'image-input.input-visible-test'
        ) as ImageInput
        const input = el.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement

        t.equal(input.hasAttribute('hidden'), false,
            'should not use the hidden attribute')
        t.notEqual(input.style.display, 'none',
            'should not set inline display:none')
        t.notEqual(input.style.visibility, 'hidden',
            'should not set inline visibility:hidden')
    })

test('.preview.has-image still drives preview visibility inside .box',
    async t => {
        document.body.innerHTML += `
            <image-input class="box-preview-test"></image-input>
        `
        const el = await waitFor(
            'image-input.box-preview-test'
        ) as ImageInput
        const file = new File(['abc'], 'photo.png', { type: 'image/png' })

        selectFile(el, file)

        const preview = el.querySelector('.preview')
        t.ok(preview?.classList.contains('has-image'),
            'the preview should gain has-image inside the new .box markup')
    })

test('the picker has no tabindex or role, relying on native label ' +
    'and input semantics', async t => {
    document.body.innerHTML += `
            <image-input class="picker-semantics-test"></image-input>
        `
    const el = await waitFor(
        'image-input.picker-semantics-test'
    ) as ImageInput
    const picker = el.querySelector('.picker') as HTMLElement

    t.equal(picker.hasAttribute('tabindex'), false,
        'the picker should not have a tabindex attribute')
    t.equal(picker.hasAttribute('role'), false,
        'the picker should not have a role attribute')
})

test('clicking the picker label opens the input, with no JS ' +
    'click-forwarding needed', async t => {
    document.body.innerHTML += `
            <image-input class="picker-click-test"></image-input>
        `
    const el = await waitFor(
        'image-input.picker-click-test'
    ) as ImageInput
    const picker = el.querySelector('.picker') as HTMLLabelElement
    const input = el.querySelector(
        'input[type="file"]'
    ) as HTMLInputElement

    let inputClicked = false
    input.addEventListener('click', () => { inputClicked = true })

    picker.click()

    t.ok(inputClicked,
        'clicking the label should forward the click to the input')
})

test('#setFile adds has-image to .box, #clear removes it', async t => {
    document.body.innerHTML += `
        <image-input class="box-has-image-test"></image-input>
    `
    const el = await waitFor(
        'image-input.box-has-image-test'
    ) as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })

    const box = el.querySelector('.box') as HTMLElement
    t.equal(box.classList.contains('has-image'), false,
        'the box should not have has-image before a file is selected')

    selectFile(el, file)

    t.ok(box.classList.contains('has-image'),
        'the box should gain has-image once a file is selected')

    const removeBtn = el.querySelector('.remove') as HTMLButtonElement
    removeBtn.click()

    t.equal(box.classList.contains('has-image'), false,
        'the box should lose has-image after remove')
})

test('dragenter on the box adds the drag class, dragleave removes it',
    async t => {
        document.body.innerHTML += `
            <image-input class="drag-class-test"></image-input>
        `
        const el = await waitFor('image-input.drag-class-test') as ImageInput
        const box = el.querySelector('.box') as HTMLElement
        const file = new File(['abc'], 'photo.png', { type: 'image/png' })

        const dt = new DataTransfer()
        dt.items.add(file)

        t.equal(box.classList.contains('drag'), false,
            'the box should not have the drag class before dragenter')

        box.dispatchEvent(new DragEvent('dragenter', {
            dataTransfer: dt,
            bubbles: true,
            cancelable: true
        }))
        t.ok(box.classList.contains('drag'),
            'dragenter should add the drag class')

        box.dispatchEvent(new DragEvent('dragleave', {
            dataTransfer: dt,
            bubbles: true,
            cancelable: true
        }))
        t.equal(box.classList.contains('drag'), false,
            'dragleave should remove the drag class')
    })

test('clicking the ALT, edit or remove buttons does not open the ' +
    'file picker', async t => {
    document.body.innerHTML += `
            <image-input class="overlay-no-open-test"></image-input>
        `
    const el = await waitFor(
        'image-input.overlay-no-open-test'
    ) as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })
    selectFile(el, file)

    const input = el.querySelector(
        'input[type="file"]'
    ) as HTMLInputElement
    let inputClicked = false
    input.addEventListener('click', () => { inputClicked = true })

    const altBadge = el.querySelector('.alt-badge') as HTMLButtonElement
    altBadge.click()
    t.equal(inputClicked, false,
        'clicking the ALT badge should not open the file picker')

    const editBtn = el.querySelector('.edit') as HTMLButtonElement
    editBtn.click()
    t.equal(inputClicked, false,
        'clicking the edit button should not open the file picker')

    const removeBtn = el.querySelector('.remove') as HTMLButtonElement
    removeBtn.click()
    t.equal(inputClicked, false,
        'clicking the remove button should not open the file picker')
})

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

test('setting alt emits image-input:alt-change', async t => {
    document.body.innerHTML += `
        <image-input class="alt-change-test"></image-input>
    `
    const el = await waitFor('image-input.alt-change-test') as ImageInput

    let detail:{ alt:string }|undefined
    el.addEventListener('image-input:alt-change', (ev:Event) => {
        detail = (ev as CustomEvent).detail
    })

    el.alt = 'a description'

    t.deepEqual(detail, { alt: 'a description' },
        'should emit alt-change with the new alt text')
})

test('clearing alt emits image-input:alt-change with an empty string',
    async t => {
        document.body.innerHTML += `
            <image-input class="alt-change-clear-test"></image-input>
        `
        const el = await waitFor(
            'image-input.alt-change-clear-test'
        ) as ImageInput
        const file = new File(['abc'], 'photo.png', { type: 'image/png' })
        selectFile(el, file)
        el.alt = 'a description'

        let detail:{ alt:string }|undefined
        el.addEventListener('image-input:alt-change', (ev:Event) => {
            detail = (ev as CustomEvent).detail
        })

        const removeBtn = el.querySelector('.remove') as HTMLButtonElement
        removeBtn.click()

        t.deepEqual(detail, { alt: '' },
            'should emit alt-change with an empty string on clear')
    })

test('change event payload has the expected shape', async t => {
    document.body.innerHTML += `
        <image-input class="change-shape-test"></image-input>
    `
    const el = await waitFor('image-input.change-shape-test') as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })

    let detail:unknown
    el.addEventListener('image-input:change', (ev:Event) => {
        detail = (ev as CustomEvent).detail
    })

    selectFile(el, file)

    t.ok(detail, 'should emit a detail object')
    t.deepEqual(Object.keys(detail as object).sort(), ['alt', 'file'],
        'detail should only contain file and alt keys')
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
