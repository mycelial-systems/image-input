import { test } from '@substrate-system/tapzero'
import { waitFor } from '@substrate-system/dom'
import '../src/index.js'
import type { ImageInput } from '../src/index.js'
import type { ImageCrop } from '../src/crop.js'
import { makeImageFile, waitForImageLoad } from './helpers.js'
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

test('the empty picker has in-flow prompt content that gives the ' +
    'box its height', async t => {
    document.body.innerHTML += `
        <image-input class="prompt-content-test"></image-input>
    `
    const el = await waitFor(
        'image-input.prompt-content-test'
    ) as ImageInput
    const picker = el.querySelector('.picker') as HTMLElement
    const prompt = picker.querySelector('.prompt') as HTMLElement

    t.ok(prompt, 'the picker should contain a .prompt element')
    t.equal(prompt.style.position, '',
        'the prompt should not be pulled out of flow inline')

    const icon = prompt.querySelector('.prompt-icon')
    t.ok(icon, 'the prompt should contain an icon')
    t.equal(icon?.getAttribute('aria-hidden'), 'true',
        'the icon should be hidden from assistive tech')

    const text = prompt.querySelector('.prompt-text')
    t.ok(text?.textContent, 'the prompt should contain non-empty text')
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

test('dropping an image renders the preview and emits change', async t => {
    document.body.innerHTML += `
        <image-input class="drop-select-test"></image-input>
    `
    const el = await waitFor('image-input.drop-select-test') as ImageInput
    const box = el.querySelector('.box') as HTMLElement
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })

    let changeDetail:{ file:File|Blob, alt:string }|null = null
    el.addEventListener('image-input:change', ((ev:CustomEvent) => {
        changeDetail = ev.detail
    }) as EventListener)

    const dt = new DataTransfer()
    dt.items.add(file)

    box.dispatchEvent(new DragEvent('drop', {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true
    }))
    await new Promise(resolve => setTimeout(resolve, 0))

    const preview = el.querySelector('.preview')
    t.ok(preview?.classList.contains('has-image'),
        'dropping an image should show the preview')
    t.ok(box.classList.contains('has-image'),
        'dropping an image should mark the box has-image')
    t.ok(changeDetail, 'should emit image-input:change')
    t.equal((changeDetail as any)?.file, file,
        'the change detail should carry the dropped file')
    t.equal((changeDetail as any)?.alt, '',
        'the change detail should carry the current alt text')
})

test('dropping an image populates input.files with one file', async t => {
    document.body.innerHTML += `
        <image-input class="drop-sync-files-test"></image-input>
    `
    const el = await waitFor(
        'image-input.drop-sync-files-test'
    ) as ImageInput
    const box = el.querySelector('.box') as HTMLElement
    const input = el.querySelector(
        'input[type="file"]'
    ) as HTMLInputElement
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })

    const dt = new DataTransfer()
    dt.items.add(file)

    box.dispatchEvent(new DragEvent('drop', {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true
    }))
    await new Promise(resolve => setTimeout(resolve, 0))

    t.equal(input.files?.length, 1,
        'input.files should have exactly one entry after a drop')
    t.equal(input.files?.[0], file,
        'input.files should carry the dropped file')
})

test('a dropped file satisfies required with no picker interaction',
    async t => {
        document.body.innerHTML += `
            <image-input class="drop-required-test" required></image-input>
        `
        const el = await waitFor(
            'image-input.drop-required-test'
        ) as ImageInput
        const box = el.querySelector('.box') as HTMLElement
        const input = el.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement
        const file = new File(['abc'], 'photo.png', { type: 'image/png' })

        t.equal(input.checkValidity(), false,
            'the required input should be invalid before any file')

        const dt = new DataTransfer()
        dt.items.add(file)

        box.dispatchEvent(new DragEvent('drop', {
            dataTransfer: dt,
            bubbles: true,
            cancelable: true
        }))
        await new Promise(resolve => setTimeout(resolve, 0))

        t.ok(input.checkValidity(),
            'a dropped file should satisfy required validation')
    })

test('#clear resets input.files as well as input.value', async t => {
    document.body.innerHTML += `
        <image-input class="drop-clear-files-test"></image-input>
    `
    const el = await waitFor(
        'image-input.drop-clear-files-test'
    ) as ImageInput
    const box = el.querySelector('.box') as HTMLElement
    const input = el.querySelector(
        'input[type="file"]'
    ) as HTMLInputElement
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })

    const dt = new DataTransfer()
    dt.items.add(file)

    box.dispatchEvent(new DragEvent('drop', {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true
    }))
    await new Promise(resolve => setTimeout(resolve, 0))

    t.equal(input.files?.length, 1, 'sanity check: file was synced')

    const removeBtn = el.querySelector('.remove') as HTMLButtonElement
    removeBtn.click()

    t.equal(input.files?.length, 0,
        'input.files should be cleared after remove')
})

test('a drop with several files uses the first image/* one', async t => {
    document.body.innerHTML += `
        <image-input class="drop-multi-test"></image-input>
    `
    const el = await waitFor('image-input.drop-multi-test') as ImageInput
    const box = el.querySelector('.box') as HTMLElement
    const textFile = new File(['abc'], 'readme.txt', {
        type: 'text/plain'
    })
    const imageFile = new File(['abc'], 'photo.png', {
        type: 'image/png'
    })

    let changeDetail:{ file:File|Blob, alt:string }|null = null
    el.addEventListener('image-input:change', ((ev:CustomEvent) => {
        changeDetail = ev.detail
    }) as EventListener)

    const dt = new DataTransfer()
    dt.items.add(textFile)
    dt.items.add(imageFile)

    box.dispatchEvent(new DragEvent('drop', {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true
    }))
    await new Promise(resolve => setTimeout(resolve, 0))

    t.equal((changeDetail as any)?.file, imageFile,
        'should select the first image/* file and ignore the rest')
})

test('dropping a non-image file emits image-input:error and leaves ' +
    'the preview hidden', async t => {
    document.body.innerHTML += `
        <image-input class="drop-error-test"></image-input>
    `
    const el = await waitFor('image-input.drop-error-test') as ImageInput
    const box = el.querySelector('.box') as HTMLElement
    const textFile = new File(['abc'], 'readme.txt', {
        type: 'text/plain'
    })

    let errorDetail:{ reason:string }|null = null
    let bubbled = false
    document.body.addEventListener('image-input:error', ((ev:CustomEvent) => {
        errorDetail = ev.detail
        bubbled = true
    }) as EventListener)

    const dt = new DataTransfer()
    dt.items.add(textFile)

    box.dispatchEvent(new DragEvent('drop', {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true
    }))
    await new Promise(resolve => setTimeout(resolve, 0))

    t.ok(bubbled, 'image-input:error should bubble')
    t.deepEqual(errorDetail, { reason: 'not-an-image' },
        'should emit the not-an-image reason')

    const preview = el.querySelector('.preview')
    t.equal(preview?.classList.contains('has-image'), false,
        'the preview should stay hidden')
})

test('picking a non-image file emits image-input:error', async t => {
    document.body.innerHTML += `
        <image-input class="pick-error-test"></image-input>
    `
    const el = await waitFor('image-input.pick-error-test') as ImageInput
    const textFile = new File(['abc'], 'readme.txt', {
        type: 'text/plain'
    })

    let errorDetail:{ reason:string }|null = null
    let bubbled = false
    document.body.addEventListener('image-input:error', ((ev:CustomEvent) => {
        errorDetail = ev.detail
        bubbled = true
    }) as EventListener)

    selectFile(el, textFile)

    t.ok(bubbled, 'image-input:error should bubble')
    t.deepEqual(errorDetail, { reason: 'not-an-image' },
        'should emit the not-an-image reason')

    const preview = el.querySelector('.preview')
    t.equal(preview?.classList.contains('has-image'), false,
        'the preview should stay hidden')
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

    let detail:{ file:File, alt:string }|undefined
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

    t.ok(detail?.file instanceof File,
        'should emit image-input:change with a File promoted from the blob')
    t.equal(detail?.file.type, blob.type,
        'the promoted File should keep the blob\'s type')

    const input = el.querySelector('input[type="file"]') as HTMLInputElement
    t.equal(input.files?.length, 1,
        'input.files should have one entry after setImage')
    t.equal(input.files?.[0]?.name, 'photo.jpg',
        'the synced file name should carry an extension matching the blob type')
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

test('setImage promotes a Blob to a File and syncs input.files', async t => {
    document.body.innerHTML += `
        <image-input class="set-image-file-test"></image-input>
    `
    const el = await waitFor('image-input.set-image-file-test') as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })
    selectFile(el, file)

    const blob = new Blob(['cropped'], { type: 'image/jpeg' })
    el.setImage(blob)

    const input = el.querySelector('input[type="file"]') as HTMLInputElement
    t.equal(input.files?.length, 1,
        'should populate input.files with exactly one entry')

    const synced = input.files?.[0] as File
    t.ok(synced instanceof File, 'the synced entry should be a File')
    t.equal(synced.name, 'photo.jpg',
        'the filename should reuse the prior base name with the new extension')

    let detail:{ file:File, alt:string }|undefined
    el.addEventListener('image-input:change', (ev:Event) => {
        detail = (ev as CustomEvent).detail
    })

    const secondBlob = new Blob(['cropped again'], { type: 'image/jpeg' })
    el.setImage(secondBlob)
    t.ok(detail?.file instanceof File,
        'image-input:change detail.file should be a File after setImage')
})

test('setImage falls back to a default name and extension', async t => {
    document.body.innerHTML += `
        <image-input class="set-image-fallback-test"></image-input>
    `
    const el = await waitFor(
        'image-input.set-image-fallback-test'
    ) as ImageInput

    const blob = new Blob(['bytes'], { type: 'image/unknown' })
    el.setImage(blob)

    const input = el.querySelector('input[type="file"]') as HTMLInputElement
    const synced = input.files?.[0] as File
    t.equal(synced.name, 'image.jpg',
        'should fall back to "image" base name and "jpg" extension')
})

test('setImage accepts an explicit filename', async t => {
    document.body.innerHTML += `
        <image-input class="set-image-name-test"></image-input>
    `
    const el = await waitFor('image-input.set-image-name-test') as ImageInput
    const blob = new Blob(['bytes'], { type: 'image/jpeg' })
    el.setImage(blob, 'cover.jpg')

    const input = el.querySelector('input[type="file"]') as HTMLInputElement
    t.equal(input.files?.[0]?.name, 'cover.jpg',
        'should use the caller-supplied filename')
})

test('clicking the edit button lazily creates an image-crop and ' +
    'opens the crop dialog', async t => {
    document.body.innerHTML += `
        <image-input class="crop-dialog-open-test"></image-input>
    `
    const el = await waitFor(
        'image-input.crop-dialog-open-test'
    ) as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })
    selectFile(el, file)

    const editBtn = el.querySelector('.edit') as HTMLButtonElement
    const cropDialog = el.querySelector('.crop-dialog') as HTMLDialogElement

    t.equal(cropDialog.open, false,
        'the crop dialog should be closed before clicking')
    t.equal(el.querySelector('image-crop'), null,
        'no image-crop should exist before the first edit click')

    editBtn.click()

    t.equal(cropDialog.open, true,
        'clicking edit should open the crop dialog')

    const cropEls = el.querySelectorAll('image-crop')
    t.equal(cropEls.length, 1,
        'exactly one image-crop should exist after the first edit click')

    const cropSlot = el.querySelector('.crop-slot')
    t.ok(cropSlot?.contains(cropEls[0]),
        'the image-crop should be appended to .crop-slot')

    const src = cropEls[0].getAttribute('src') ?? ''
    t.ok(src.startsWith('blob:'),
        'setFile should be called with the current file')
})

test('reopening the crop dialog reuses the existing image-crop, ' +
    'without appending a duplicate', async t => {
    document.body.innerHTML += `
        <image-input class="crop-dialog-reuse-test"></image-input>
    `
    const el = await waitFor(
        'image-input.crop-dialog-reuse-test'
    ) as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })
    selectFile(el, file)

    const editBtn = el.querySelector('.edit') as HTMLButtonElement
    const cropDialog = el.querySelector('.crop-dialog') as HTMLDialogElement

    editBtn.click()
    const firstCropEl = el.querySelector('image-crop')
    cropDialog.close()

    editBtn.click()

    t.equal(cropDialog.open, true,
        'clicking edit again should reopen the crop dialog')
    t.equal(el.querySelectorAll('image-crop').length, 1,
        'reopening should not append a second image-crop')
    t.equal(el.querySelector('image-crop'), firstCropEl,
        'reopening should reuse the same image-crop element')
})

test('clicking .crop-save calls getBlob, applies the crop via ' +
    'setImage, and closes the dialog', async t => {
    document.body.innerHTML += `
        <image-input class="crop-save-test"></image-input>
    `
    const el = await waitFor('image-input.crop-save-test') as ImageInput
    const file = await makeImageFile(200, 100)
    selectFile(el, file)

    const editBtn = el.querySelector('.edit') as HTMLButtonElement
    const cropDialog = el.querySelector('.crop-dialog') as HTMLDialogElement
    editBtn.click()

    const cropEl = el.querySelector('image-crop') as ImageCrop
    await waitForImageLoad(cropEl)

    const saveBtn = cropDialog.querySelector(
        '.crop-save'
    ) as HTMLButtonElement

    const imgBefore = el.querySelector('img') as HTMLImageElement
    const srcBefore = imgBefore.getAttribute('src')

    const changed = new Promise<{ file:File, alt:string }>(resolve => {
        el.addEventListener('image-input:change', ((ev:CustomEvent) => {
            resolve(ev.detail)
        }) as EventListener, { once: true })
    })

    saveBtn.click()
    const detail = await changed

    t.equal(cropDialog.open, false, 'saving should close the crop dialog')
    t.ok(detail.file instanceof File,
        'should emit image-input:change with a File built from the ' +
        'crop blob')

    const imgAfter = el.querySelector('img') as HTMLImageElement
    t.ok(imgAfter.getAttribute('src'), 'should set a new preview src')
    t.notEqual(imgAfter.getAttribute('src'), srcBefore,
        'should replace the preview with the cropped image')

    const input = el.querySelector('input[type="file"]') as HTMLInputElement
    t.equal(input.files?.[0], detail.file,
        'should sync input.files with the cropped file')
})

test('clicking .crop-cancel closes the dialog and leaves the current ' +
    'image and file unchanged', async t => {
    document.body.innerHTML += `
        <image-input class="crop-cancel-test"></image-input>
    `
    const el = await waitFor('image-input.crop-cancel-test') as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })
    selectFile(el, file)

    const editBtn = el.querySelector('.edit') as HTMLButtonElement
    const cropDialog = el.querySelector('.crop-dialog') as HTMLDialogElement
    editBtn.click()

    t.equal(cropDialog.open, true, 'sanity check: crop dialog is open')

    const img = el.querySelector('img') as HTMLImageElement
    const srcBefore = img.getAttribute('src')

    let changeFired = false
    el.addEventListener('image-input:change', () => { changeFired = true })

    const cancelBtn = cropDialog.querySelector(
        '.crop-cancel'
    ) as HTMLButtonElement
    cancelBtn.click()

    t.equal(cropDialog.open, false, 'canceling should close the crop dialog')
    t.equal(img.getAttribute('src'), srcBefore,
        'canceling should leave the preview image unchanged')
    t.equal(changeFired, false,
        'canceling should not emit image-input:change')

    const input = el.querySelector('input[type="file"]') as HTMLInputElement
    t.equal(input.files?.[0], file,
        'canceling should leave input.files unchanged')
})

test('canceling image-input:edit stops the crop dialog opening and ' +
    'creates no image-crop element', async t => {
    document.body.innerHTML += `
        <image-input class="edit-cancelable-test"></image-input>
    `
    const el = await waitFor(
        'image-input.edit-cancelable-test'
    ) as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })
    selectFile(el, file)

    el.addEventListener('image-input:edit', (ev:Event) => {
        ev.preventDefault()
    })

    const editBtn = el.querySelector('.edit') as HTMLButtonElement
    const cropDialog = el.querySelector('.crop-dialog') as HTMLDialogElement

    editBtn.click()

    t.equal(cropDialog.open, false,
        'the crop dialog should stay closed when edit is canceled')
    t.equal(el.querySelector('image-crop'), null,
        'no image-crop should be created when edit is canceled')
})

test('clicking the ALT badge opens the alt dialog, seeded with the ' +
    'current alt text', async t => {
    document.body.innerHTML += `
        <image-input class="alt-dialog-open-test"></image-input>
    `
    const el = await waitFor(
        'image-input.alt-dialog-open-test'
    ) as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })
    selectFile(el, file)
    el.alt = 'a description'

    const altBadge = el.querySelector('.alt-badge') as HTMLButtonElement
    const altDialog = el.querySelector('.alt-dialog') as HTMLDialogElement
    const textarea = altDialog.querySelector(
        'textarea'
    ) as HTMLTextAreaElement

    t.equal(altDialog.open, false,
        'the alt dialog should be closed before clicking')

    altBadge.click()

    t.equal(altDialog.open, true,
        'clicking the ALT badge should open the alt dialog')
    t.equal(textarea.value, 'a description',
        'the textarea should be seeded with the current alt text')
})

test('clicking .alt-save applies the textarea value and closes the ' +
    'dialog', async t => {
    document.body.innerHTML += `
        <image-input class="alt-save-test"></image-input>
    `
    const el = await waitFor('image-input.alt-save-test') as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })
    selectFile(el, file)

    const altBadge = el.querySelector('.alt-badge') as HTMLButtonElement
    const altDialog = el.querySelector('.alt-dialog') as HTMLDialogElement
    const textarea = altDialog.querySelector(
        'textarea'
    ) as HTMLTextAreaElement
    const saveBtn = altDialog.querySelector(
        '.alt-save'
    ) as HTMLButtonElement

    altBadge.click()
    textarea.value = 'a new description'

    let detail:{ alt:string }|undefined
    el.addEventListener('image-input:alt-change', (ev:Event) => {
        detail = (ev as CustomEvent).detail
    })

    saveBtn.click()

    t.equal(altDialog.open, false, 'saving should close the dialog')
    t.equal(el.alt, 'a new description',
        'saving should assign the textarea value to alt')
    t.deepEqual(detail, { alt: 'a new description' },
        'saving should emit image-input:alt-change with the new value')

    const img = el.querySelector('img')
    t.equal(img?.getAttribute('alt'), 'a new description',
        'saving should update the img alt attribute')

    const altBadgeAfter = el.querySelector('.alt-badge')
    t.ok(altBadgeAfter?.classList.contains('has-alt'),
        'saving should update the badge has-alt state')
})

test('clicking .alt-cancel closes the dialog and leaves alt unchanged',
    async t => {
        document.body.innerHTML += `
            <image-input class="alt-cancel-test"></image-input>
        `
        const el = await waitFor(
            'image-input.alt-cancel-test'
        ) as ImageInput
        const file = new File(['abc'], 'photo.png', { type: 'image/png' })
        selectFile(el, file)
        el.alt = 'original description'

        const altBadge = el.querySelector('.alt-badge') as HTMLButtonElement
        const altDialog = el.querySelector(
            '.alt-dialog'
        ) as HTMLDialogElement
        const textarea = altDialog.querySelector(
            'textarea'
        ) as HTMLTextAreaElement
        const cancelBtn = altDialog.querySelector(
            '.alt-cancel'
        ) as HTMLButtonElement

        altBadge.click()
        textarea.value = 'a discarded edit'

        let changeFired = false
        el.addEventListener('image-input:alt-change', () => {
            changeFired = true
        })

        cancelBtn.click()

        t.equal(altDialog.open, false, 'canceling should close the dialog')
        t.equal(el.alt, 'original description',
            'canceling should leave alt unchanged')
        t.equal(changeFired, false,
            'canceling should not emit image-input:alt-change')
    })

test('canceling image-input:alt stops the alt dialog opening', async t => {
    document.body.innerHTML += `
        <image-input class="alt-cancelable-test"></image-input>
    `
    const el = await waitFor(
        'image-input.alt-cancelable-test'
    ) as ImageInput
    const file = new File(['abc'], 'photo.png', { type: 'image/png' })
    selectFile(el, file)

    el.addEventListener('image-input:alt', (ev:Event) => {
        ev.preventDefault()
    })

    const altBadge = el.querySelector('.alt-badge') as HTMLButtonElement
    const altDialog = el.querySelector('.alt-dialog') as HTMLDialogElement

    altBadge.click()

    t.equal(altDialog.open, false,
        'the alt dialog should stay closed when alt is canceled')
})

test('render() emits the alt and crop dialogs as siblings of .box, ' +
    'closed by default', async t => {
    document.body.innerHTML += `
        <image-input class="dialogs-render-test"></image-input>
    `
    const el = await waitFor(
        'image-input.dialogs-render-test'
    ) as ImageInput

    const box = el.querySelector('.box') as HTMLElement
    const altDialog = el.querySelector('.alt-dialog') as HTMLDialogElement
    const cropDialog = el.querySelector('.crop-dialog') as HTMLDialogElement

    t.ok(altDialog, 'should render an .alt-dialog')
    t.ok(cropDialog, 'should render a .crop-dialog')
    t.equal(altDialog.tagName, 'DIALOG',
        'the alt dialog should be a <dialog> element')
    t.equal(cropDialog.tagName, 'DIALOG',
        'the crop dialog should be a <dialog> element')

    t.equal(box.contains(altDialog), false,
        'the alt dialog should not be nested inside .box')
    t.equal(box.contains(cropDialog), false,
        'the crop dialog should not be nested inside .box')

    t.equal(altDialog.parentElement, el,
        'the alt dialog should be a direct child of image-input')
    t.equal(cropDialog.parentElement, el,
        'the crop dialog should be a direct child of image-input')

    t.equal(altDialog.open, false,
        'the alt dialog should be closed by default')
    t.equal(cropDialog.open, false,
        'the crop dialog should be closed by default')
})

test('the alt dialog contains a heading, a label-wrapped textarea, ' +
    'and a menu with save/cancel buttons', async t => {
    document.body.innerHTML += `
        <image-input class="alt-dialog-structure-test"></image-input>
    `
    const el = await waitFor(
        'image-input.alt-dialog-structure-test'
    ) as ImageInput
    const altDialog = el.querySelector('.alt-dialog') as HTMLDialogElement

    const heading = altDialog.querySelector('h1, h2, h3, h4, h5, h6')
    t.ok(heading, 'the alt dialog should contain a heading element')

    const label = altDialog.querySelector('label')
    const textarea = label?.querySelector('textarea')
    t.ok(label, 'the alt dialog should contain a label')
    t.ok(textarea, 'the label should wrap a textarea')
    t.ok(label?.contains(textarea as Node),
        'the textarea should be inside the label')
    t.equal(textarea?.getAttribute('rows'), '4',
        'the textarea should have rows="4"')

    const menu = altDialog.querySelector('menu')
    t.ok(menu, 'the alt dialog should contain a menu')
    t.ok(menu?.querySelector('.alt-cancel'),
        'the menu should contain an .alt-cancel button')
    t.ok(menu?.querySelector('.alt-save'),
        'the menu should contain an .alt-save button')
})

test('the crop dialog contains a heading, an empty .crop-slot, and a ' +
    'menu with save/cancel buttons', async t => {
    document.body.innerHTML += `
        <image-input class="crop-dialog-structure-test"></image-input>
    `
    const el = await waitFor(
        'image-input.crop-dialog-structure-test'
    ) as ImageInput
    const cropDialog = el.querySelector('.crop-dialog') as HTMLDialogElement

    const heading = cropDialog.querySelector('h1, h2, h3, h4, h5, h6')
    t.ok(heading, 'the crop dialog should contain a heading element')

    const slot = cropDialog.querySelector('.crop-slot')
    t.ok(slot, 'the crop dialog should contain a .crop-slot')
    t.equal(slot?.childElementCount, 0, 'the .crop-slot should be empty')

    const menu = cropDialog.querySelector('menu')
    t.ok(menu, 'the crop dialog should contain a menu')
    t.ok(menu?.querySelector('.crop-cancel'),
        'the menu should contain a .crop-cancel button')
    t.ok(menu?.querySelector('.crop-save'),
        'the menu should contain a .crop-save button')
})

test('dialog markup has no ids, no for attributes, no ' +
    'aria-labelledby, and every button stays type="button"', async t => {
    document.body.innerHTML += `
        <image-input class="dialog-a11y-test"></image-input>
    `
    const el = await waitFor('image-input.dialog-a11y-test') as ImageInput
    const altDialog = el.querySelector('.alt-dialog') as HTMLDialogElement
    const cropDialog = el.querySelector('.crop-dialog') as HTMLDialogElement

    for (const dialog of [altDialog, cropDialog]) {
        t.equal(dialog.hasAttribute('id'), false,
            'the dialog itself should not have an id attribute')
        t.equal(dialog.querySelector('[id]'), null,
            'no descendant should have an id attribute')
        t.equal(dialog.querySelector('[for]'), null,
            'no descendant should have a for attribute')
        t.equal(dialog.hasAttribute('aria-labelledby'), false,
            'the dialog should not use aria-labelledby')
        t.ok(dialog.getAttribute('aria-label'),
            'the dialog should carry an aria-label instead')
    }

    const textarea = altDialog.querySelector('textarea')
    t.equal(textarea?.hasAttribute('name'), false,
        'the textarea should have no name attribute')

    const buttons = Array.from(
        el.querySelectorAll('.alt-dialog button, .crop-dialog button')
    )
    t.ok(buttons.length > 0, 'sanity check: dialogs contain buttons')
    for (const button of buttons) {
        t.equal(button.getAttribute('type'), 'button',
            'every dialog button should be type="button"')
    }
})

test('two image-input elements each render their own dialogs with no ' +
    'duplicate ids', async t => {
    document.body.innerHTML += `
        <image-input class="dupe-a"></image-input>
        <image-input class="dupe-b"></image-input>
    `
    const a = await waitFor('image-input.dupe-a') as ImageInput
    const b = await waitFor('image-input.dupe-b') as ImageInput

    t.equal(a.querySelectorAll('.alt-dialog').length, 1,
        'each image-input should render exactly one alt dialog')
    t.equal(a.querySelectorAll('.crop-dialog').length, 1,
        'each image-input should render exactly one crop dialog')
    t.equal(b.querySelectorAll('.alt-dialog').length, 1,
        'each image-input should render exactly one alt dialog')
    t.equal(b.querySelectorAll('.crop-dialog').length, 1,
        'each image-input should render exactly one crop dialog')

    t.notEqual(a.querySelector('.alt-dialog'), b.querySelector('.alt-dialog'),
        'the two elements should have distinct alt dialog instances')
    t.notEqual(a.querySelector('.crop-dialog'), b.querySelector('.crop-dialog'),
        'the two elements should have distinct crop dialog instances')

    const ids = Array.from(document.querySelectorAll('[id]'))
        .map(elem => elem.id)
    const uniqueIds = new Set(ids)
    t.equal(ids.length, uniqueIds.size,
        'no id on the page should be duplicated')
})

test('the input has a default aria-label matching the default prompt',
    async t => {
        document.body.innerHTML += `
            <image-input class="label-default-test"></image-input>
        `
        const el = await waitFor(
            'image-input.label-default-test'
        ) as ImageInput
        const input = el.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement

        t.ok(input.getAttribute('aria-label'),
            'the input should have a non-empty default aria-label')
    })

test('setting the label attribute updates the prompt text and the ' +
    'input aria-label', async t => {
    document.body.innerHTML += `
        <image-input class="label-set-test"></image-input>
    `
    const el = await waitFor('image-input.label-set-test') as ImageInput
    const input = el.querySelector(
        'input[type="file"]'
    ) as HTMLInputElement
    const promptText = el.querySelector('.prompt-text') as HTMLElement

    el.label = 'Drag a photo here'

    t.equal(input.getAttribute('aria-label'), 'Drag a photo here',
        'the input aria-label should match the label attribute')
    t.equal(promptText.textContent, 'Drag a photo here',
        'the prompt text should match the label attribute')
})
