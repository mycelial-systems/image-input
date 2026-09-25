import { test } from '@substrate-system/tapzero'
import { waitFor } from '@substrate-system/dom'
import './style.js'
import { ImageInput, type ImageInputEventMap } from '../src/index.js'
import { ImageCrop as RootImageCrop } from '../src/index.js'
import type { ImageCrop } from '../src/crop.js'
import { html } from '../src/html.js'
import {
    makeImageFile,
    waitForCropRect,
    waitForImageLoad
} from './helpers.js'
import { imageBlob, imageFile, imageDataUrl } from './fixture.js'
import './crop.js'
import './crop-math.js'
import './html.js'
import './client.js'
import './file.js'
import './crop-dialog.js'

test('renders a .box div instead of .wrapper', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <${ImageInput.TAG} class="box-test" accept="image/png" name="photo" required>
        </${ImageInput.TAG}>
    `)
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
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="input-attrs-test" accept="image/png"
                name="photo" required></image-input>
        `)
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
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="input-visible-test"></image-input>
        `)
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
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="box-preview-test"></image-input>
        `)
        const el = await waitFor(
            'image-input.box-preview-test'
        ) as ImageInput
        const file = imageFile('photo.png', 'image/png')

        selectFile(el, file)

        const preview = el.querySelector('.preview')
        t.ok(preview?.classList.contains('has-image'),
            'the preview should gain has-image inside the new .box markup')
    })

test('the picker has no tabindex or role, relying on native label ' +
    'and input semantics', async t => {
    document.body.insertAdjacentHTML('beforeend', `
            <image-input class="picker-semantics-test"></image-input>
        `)
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
    document.body.insertAdjacentHTML('beforeend', `
            <image-input class="picker-click-test"></image-input>
        `)
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="prompt-content-test"></image-input>
    `)
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="box-has-image-test"></image-input>
    `)
    const el = await waitFor(
        'image-input.box-has-image-test'
    ) as ImageInput
    const file = imageFile('photo.png', 'image/png')

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
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="drag-class-test"></image-input>
        `)
        const el = await waitFor('image-input.drag-class-test') as ImageInput
        const box = el.querySelector('.box') as HTMLElement
        const file = imageFile('photo.png', 'image/png')

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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="drop-select-test"></image-input>
    `)
    const el = await waitFor('image-input.drop-select-test') as ImageInput
    const box = el.querySelector('.box') as HTMLElement
    const file = imageFile('photo.png', 'image/png')

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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="drop-sync-files-test"></image-input>
    `)
    const el = await waitFor(
        'image-input.drop-sync-files-test'
    ) as ImageInput
    const box = el.querySelector('.box') as HTMLElement
    const input = el.querySelector(
        'input[type="file"]'
    ) as HTMLInputElement
    const file = imageFile('photo.png', 'image/png')

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
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="drop-required-test" required></image-input>
        `)
        const el = await waitFor(
            'image-input.drop-required-test'
        ) as ImageInput
        const box = el.querySelector('.box') as HTMLElement
        const input = el.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement
        const file = imageFile('photo.png', 'image/png')

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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="drop-clear-files-test"></image-input>
    `)
    const el = await waitFor(
        'image-input.drop-clear-files-test'
    ) as ImageInput
    const box = el.querySelector('.box') as HTMLElement
    const input = el.querySelector(
        'input[type="file"]'
    ) as HTMLInputElement
    const file = imageFile('photo.png', 'image/png')

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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="drop-multi-test"></image-input>
    `)
    const el = await waitFor('image-input.drop-multi-test') as ImageInput
    const box = el.querySelector('.box') as HTMLElement
    const textFile = new File(['abc'], 'readme.txt', {
        type: 'text/plain'
    })
    const picture = imageFile('photo.png', 'image/png')

    let changeDetail:{ file:File|Blob, alt:string }|null = null
    el.addEventListener('image-input:change', ((ev:CustomEvent) => {
        changeDetail = ev.detail
    }) as EventListener)

    const dt = new DataTransfer()
    dt.items.add(textFile)
    dt.items.add(picture)

    box.dispatchEvent(new DragEvent('drop', {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true
    }))
    await new Promise(resolve => setTimeout(resolve, 0))

    t.equal((changeDetail as any)?.file, picture,
        'should select the first image/* file and ignore the rest')
})

test('dropping a non-image file emits image-input:error and leaves ' +
    'the preview hidden', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="drop-error-test"></image-input>
    `)
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="pick-error-test"></image-input>
    `)
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
    document.body.insertAdjacentHTML('beforeend', `
            <image-input class="overlay-no-open-test"></image-input>
        `)
    const el = await waitFor(
        'image-input.overlay-no-open-test'
    ) as ImageInput
    const file = imageFile('photo.png', 'image/png')
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="test">
        </image-input>
    `)

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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="overlay-test"></image-input>
    `)
    const el = await waitFor('image-input.overlay-test') as ImageInput
    const file = imageFile('photo.png', 'image/png')

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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="alt-test"></image-input>
    `)
    const el = await waitFor('image-input.alt-test') as ImageInput
    const file = imageFile('photo.png', 'image/png')
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="remove-test"></image-input>
    `)
    const el = await waitFor('image-input.remove-test') as ImageInput
    const file = imageFile('photo.png', 'image/png')
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="edit-test"></image-input>
    `)
    const el = await waitFor('image-input.edit-test') as ImageInput
    const file = imageFile('photo.png', 'image/png')
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="alt-event-test"></image-input>
    `)
    const el = await waitFor('image-input.alt-event-test') as ImageInput
    const file = imageFile('photo.png', 'image/png')
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="alt-change-test"></image-input>
    `)
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
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="alt-change-clear-test"></image-input>
        `)
        const el = await waitFor(
            'image-input.alt-change-clear-test'
        ) as ImageInput
        const file = imageFile('photo.png', 'image/png')
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="change-shape-test"></image-input>
    `)
    const el = await waitFor('image-input.change-shape-test') as ImageInput
    const file = imageFile('photo.png', 'image/png')

    let detail:unknown
    el.addEventListener('image-input:change', (ev:Event) => {
        detail = (ev as CustomEvent).detail
    })

    selectFile(el, file)

    t.ok(detail, 'should emit a detail object')
    t.deepEqual(Object.keys(detail as object).sort(),
        ['alt', 'file', 'source'],
        'detail should only contain file, alt and source keys')
})

test('change event detail includes the current alt text', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="change-alt-test"></image-input>
    `)
    const el = await waitFor('image-input.change-alt-test') as ImageInput
    const file = imageFile('photo.png', 'image/png')

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
    const secondFile = imageFile('photo2.png', 'image/png')
    selectFile(el, secondFile)

    t.equal(detail?.alt, 'a description',
        'should emit the current alt text once set')
})

test('setImage replaces the preview with the given blob', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="set-image-test"></image-input>
    `)
    const el = await waitFor('image-input.set-image-test') as ImageInput
    const file = imageFile('photo.png', 'image/png')
    selectFile(el, file)

    const imgBefore = el.querySelector('img') as HTMLImageElement
    const srcBefore = imgBefore.getAttribute('src')

    const blob = imageBlob()

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

test('clear() is public and does not emit remove', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="public-clear-test"></image-input>
    `)
    const el = await waitFor('image-input.public-clear-test') as ImageInput
    selectFile(el, imageFile('photo.png', 'image/png'))
    el.alt = 'a description'

    let removeCount = 0
    el.addEventListener('image-input:remove', () => { removeCount++ })

    el.clear()

    const box = el.querySelector('.box')
    t.equal(box?.classList.contains('has-image'), false,
        'the box should lose has-image after clear()')
    t.equal(el.alt, null, 'should reset the alt text')

    const input = el.querySelector('input[type="file"]') as HTMLInputElement
    t.equal(input.value, '', 'should reset the file input')
    t.equal(input.files?.length, 0, 'should reset input.files')

    t.equal(removeCount, 0,
        'clear() should not emit image-input:remove -- that event ' +
        'means the user clicked the remove button')
})

test('the static form works without a this binding', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="static-clear-test"></image-input>
    `)
    const el = await waitFor('image-input.static-clear-test') as ImageInput
    selectFile(el, imageFile('photo.png', 'image/png'))

    const clear = ImageInput.clear
    clear(el)

    const box = el.querySelector('.box')
    t.equal(box?.classList.contains('has-image'), false,
        'ImageInput.clear(el) should clear the element')

    const setImage = ImageInput.setImage
    setImage(el, imageBlob())

    t.equal(box?.classList.contains('has-image'), true,
        'ImageInput.setImage(el, blob) should set the preview')
})

test('setImage revokes the previous preview object URL', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="set-image-revoke-test"></image-input>
    `)
    const el = await waitFor('image-input.set-image-revoke-test') as ImageInput
    const file = imageFile('photo.png', 'image/png')
    selectFile(el, file)

    const revoked:string[] = []
    const original = URL.revokeObjectURL
    URL.revokeObjectURL = (url:string) => {
        revoked.push(url)
        return original.call(URL, url)
    }

    const imgBefore = el.querySelector('img') as HTMLImageElement
    const srcBefore = imgBefore.getAttribute('src') as string

    const blob = imageBlob()
    el.setImage(blob)

    URL.revokeObjectURL = original

    t.ok(revoked.includes(srcBefore),
        'should revoke the previous preview object URL')
})

test('setImage promotes a Blob to a File and syncs input.files', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="set-image-file-test"></image-input>
    `)
    const el = await waitFor('image-input.set-image-file-test') as ImageInput
    const file = imageFile('photo.png', 'image/png')
    selectFile(el, file)

    const blob = imageBlob()
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

    const secondBlob = imageBlob()
    el.setImage(secondBlob)
    t.ok(detail?.file instanceof File,
        'image-input:change detail.file should be a File after setImage')
})

test('setImage falls back to a default name and extension', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="set-image-fallback-test"></image-input>
    `)
    const el = await waitFor(
        'image-input.set-image-fallback-test'
    ) as ImageInput

    const blob = imageBlob('image/unknown')
    el.setImage(blob)

    const input = el.querySelector('input[type="file"]') as HTMLInputElement
    const synced = input.files?.[0] as File
    t.equal(synced.name, 'image.jpg',
        'should fall back to "image" base name and "jpg" extension')
})

test('setImage accepts an explicit filename', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="set-image-name-test"></image-input>
    `)
    const el = await waitFor('image-input.set-image-name-test') as ImageInput
    const blob = imageBlob()
    el.setImage(blob, 'cover.jpg')

    const input = el.querySelector('input[type="file"]') as HTMLInputElement
    t.equal(input.files?.[0]?.name, 'cover.jpg',
        'should use the caller-supplied filename')
})

test('clicking the edit button lazily creates an image-crop and ' +
    'opens the crop dialog', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="crop-dialog-open-test"></image-input>
    `)
    const el = await waitFor(
        'image-input.crop-dialog-open-test'
    ) as ImageInput
    const file = imageFile('photo.png', 'image/png')
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

test('clicking edit forwards the crop attribute onto the lazily ' +
    'created image-crop', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="crop-forward-test" crop="circle"></image-input>
    `)
    const el = await waitFor(
        'image-input.crop-forward-test'
    ) as ImageInput
    const file = imageFile('photo.png', 'image/png')
    selectFile(el, file)

    const editBtn = el.querySelector('.edit') as HTMLButtonElement
    editBtn.click()

    const cropEl = el.querySelector('image-crop') as HTMLElement
    t.equal(cropEl.getAttribute('crop'), 'circle',
        'the crop attribute should be forwarded onto the image-crop')
})

test('reopening the crop dialog reuses the existing image-crop, ' +
    'without appending a duplicate', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="crop-dialog-reuse-test"></image-input>
    `)
    const el = await waitFor(
        'image-input.crop-dialog-reuse-test'
    ) as ImageInput
    const file = imageFile('photo.png', 'image/png')
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="crop-save-test"></image-input>
    `)
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
    t.equal(detail.file.type, 'image/png',
        'the cropped file should keep the source image type rather ' +
        'than being re-encoded as jpeg')
    t.ok(detail.file.name.endsWith('.png'),
        'deriveName should follow the blob type')

    const imgAfter = el.querySelector('img') as HTMLImageElement
    t.ok(imgAfter.getAttribute('src'), 'should set a new preview src')
    t.notEqual(imgAfter.getAttribute('src'), srcBefore,
        'should replace the preview with the cropped image')

    const input = el.querySelector('input[type="file"]') as HTMLInputElement
    t.equal(input.files?.[0], detail.file,
        'should sync input.files with the cropped file')
})

test('reopening the crop dialog on a different image does not carry ' +
    'over the previous image\'s crop rect', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="crop-stale-rect-test"></image-input>
    `)
    const el = await waitFor(
        'image-input.crop-stale-rect-test'
    ) as ImageInput

    const editBtn = el.querySelector('.edit') as HTMLButtonElement
    const cropDialog = el.querySelector('.crop-dialog') as HTMLDialogElement
    const saveBtn = cropDialog.querySelector(
        '.crop-save'
    ) as HTMLButtonElement

    // crop and save a first, wide image
    selectFile(el, await makeImageFile(400, 200))
    editBtn.click()
    const cropEl = el.querySelector('image-crop') as ImageCrop
    await waitForImageLoad(cropEl)

    const firstRect = cropEl.crop
    t.equal(firstRect.width, 400,
        'sanity check: the first image fills the crop rect')

    const changed = new Promise<void>(resolve => {
        el.addEventListener('image-input:change', () => resolve(), {
            once: true
        })
    })
    saveBtn.click()
    await changed
    t.equal(cropDialog.open, false, 'sanity check: saving closed the dialog')

    // open the crop dialog again on a second, smaller image
    selectFile(el, await makeImageFile(200, 100))
    editBtn.click()

    t.notDeepEqual(cropEl.crop, firstRect,
        'the crop rect should not still be the first image\'s rect ' +
        'while the second image is still loading')

    await waitForCropRect(cropEl, 200)
    t.deepEqual(cropEl.crop, { x: 0, y: 0, width: 200, height: 100 },
        'the crop rect should match the second image once it loads')
})

test('saving the crop before the image has loaded leaves the current ' +
    'image alone and keeps the dialog open', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="crop-save-too-early-test"></image-input>
    `)
    const el = await waitFor(
        'image-input.crop-save-too-early-test'
    ) as ImageInput

    selectFile(el, await makeImageFile(200, 100))

    const editBtn = el.querySelector('.edit') as HTMLButtonElement
    const cropDialog = el.querySelector('.crop-dialog') as HTMLDialogElement
    const saveBtn = cropDialog.querySelector(
        '.crop-save'
    ) as HTMLButtonElement

    editBtn.click()

    const img = el.querySelector('img') as HTMLImageElement
    const srcBefore = img.getAttribute('src')

    let changeFired = false
    el.addEventListener('image-input:change', () => { changeFired = true })

    // click Save in the window before the crop element's image has
    // decoded, so there is no crop rect yet
    saveBtn.click()
    await new Promise(resolve => setTimeout(resolve, 0))

    t.equal(changeFired, false,
        'should not emit image-input:change when there is nothing to crop')
    t.equal(img.getAttribute('src'), srcBefore,
        'should leave the preview image unchanged')
    t.equal(cropDialog.open, true,
        'should leave the dialog open so the user can retry')
})

test('clicking .crop-cancel closes the dialog and leaves the current ' +
    'image and file unchanged', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="crop-cancel-test"></image-input>
    `)
    const el = await waitFor('image-input.crop-cancel-test') as ImageInput
    const file = imageFile('photo.png', 'image/png')
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="edit-cancelable-test"></image-input>
    `)
    const el = await waitFor(
        'image-input.edit-cancelable-test'
    ) as ImageInput
    const file = imageFile('photo.png', 'image/png')
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

test('nocrop hides the edit button and leaves the rest of the ' +
    'overlay alone', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="nocrop-hidden-test" nocrop></image-input>
    `)
    const el = await waitFor('image-input.nocrop-hidden-test') as ImageInput
    selectFile(el, imageFile('photo.png', 'image/png'))

    t.equal(el.nocrop, true,
        'the attribute should be reflected as a property')

    const editBtn = el.querySelector('.edit') as HTMLButtonElement
    t.equal(getComputedStyle(editBtn).display, 'none',
        'the stylesheet should hide the edit button while nocrop is set')

    const altBadge = el.querySelector('.alt-badge') as HTMLElement
    const removeBtn = el.querySelector('.remove') as HTMLElement
    t.notEqual(getComputedStyle(altBadge).display, 'none',
        'the ALT badge should stay visible')
    t.notEqual(getComputedStyle(removeBtn).display, 'none',
        'the remove button should stay visible')
})

test('nocrop makes the edit trigger inert, with no event and no ' +
    'crop dialog', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="nocrop-inert-test" nocrop></image-input>
    `)
    const el = await waitFor('image-input.nocrop-inert-test') as ImageInput
    selectFile(el, imageFile('photo.png', 'image/png'))

    let editCount = 0
    el.addEventListener('image-input:edit', () => { editCount++ })

    const editBtn = el.querySelector('.edit') as HTMLButtonElement
    const cropDialog = el.querySelector('.crop-dialog') as HTMLDialogElement
    editBtn.click()

    t.equal(editCount, 0,
        'image-input:edit should not fire while nocrop is set, even ' +
        'for a scripted click the stylesheet cannot stop')
    t.equal(cropDialog.open, false,
        'the crop dialog should stay closed')
    t.equal(el.querySelector('image-crop'), null,
        'no image-crop should be created')
})

test('nocrop is honored when toggled at runtime, in both directions, ' +
    'with no re-render', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="nocrop-toggle-test"></image-input>
    `)
    const el = await waitFor('image-input.nocrop-toggle-test') as ImageInput
    selectFile(el, imageFile('photo.png', 'image/png'))

    let editCount = 0
    el.addEventListener('image-input:edit', () => { editCount++ })

    const editBtn = el.querySelector('.edit') as HTMLButtonElement
    t.notEqual(getComputedStyle(editBtn).display, 'none',
        'the edit button should be visible with no nocrop attribute')

    el.nocrop = true

    t.equal(el.hasAttribute('nocrop'), true,
        'setting the property should write the attribute')
    t.equal(getComputedStyle(editBtn).display, 'none',
        'setting nocrop should hide the edit button immediately')
    t.equal(el.querySelector('.edit'), editBtn,
        'setting nocrop should not re-render the markup')

    editBtn.click()
    t.equal(editCount, 0, 'the trigger should be inert while set')

    el.nocrop = false

    t.equal(el.hasAttribute('nocrop'), false,
        'clearing the property should remove the attribute')
    t.notEqual(getComputedStyle(editBtn).display, 'none',
        'clearing nocrop should show the edit button again')
    t.equal(el.querySelector('.edit'), editBtn,
        'clearing nocrop should not re-render the markup either')

    editBtn.click()
    t.equal(editCount, 1, 'the trigger should work again once cleared')
})

test('nocrop suppresses the trigger and nothing else', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="nocrop-scope-test" nocrop></image-input>
    `)
    const el = await waitFor('image-input.nocrop-scope-test') as ImageInput
    const file = imageFile('photo.png', 'image/png')
    selectFile(el, file)

    const preview = el.querySelector('.preview') as HTMLElement
    t.ok(preview.classList.contains('has-image'),
        'picking a file should still render the preview')

    let altDetail:{ file:File, alt:string }|undefined
    el.addEventListener('image-input:alt', (ev:Event) => {
        altDetail = (ev as CustomEvent).detail
    })
    ;(el.querySelector('.alt-badge') as HTMLButtonElement).click()
    t.equal(altDetail?.file, file,
        'the ALT badge should still emit image-input:alt')

    let changeDetail:{ file:File, alt:string }|undefined
    el.addEventListener('image-input:change', (ev:Event) => {
        changeDetail = (ev as CustomEvent).detail
    })
    el.setImage(imageBlob())
    t.ok(changeDetail?.file instanceof File,
        'setImage should still replace the image and emit change')

    const input = el.querySelector('input[type="file"]') as HTMLInputElement
    t.equal(input.files?.length, 1,
        'setImage should still sync input.files')

    ;(el.querySelector('.remove') as HTMLButtonElement).click()
    t.equal(preview.classList.contains('has-image'), false,
        'remove should still clear the preview')
})

test('the rendered markup is identical with and without nocrop',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="nocrop-markup-test" nocrop></image-input>
        `)
        const el = await waitFor(
            'image-input.nocrop-markup-test'
        ) as ImageInput

        const fromHtml = document.createElement('div')
        fromHtml.innerHTML = html({ text: ImageInput.TEXT })

        t.equal(el.innerHTML, fromHtml.innerHTML,
            'nocrop should change no markup -- it is hidden by the ' +
            'stylesheet, not omitted from the template')
    })

test('clicking the ALT badge opens the alt dialog, seeded with the ' +
    'current alt text', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="alt-dialog-open-test"></image-input>
    `)
    const el = await waitFor(
        'image-input.alt-dialog-open-test'
    ) as ImageInput
    const file = imageFile('photo.png', 'image/png')
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="alt-save-test"></image-input>
    `)
    const el = await waitFor('image-input.alt-save-test') as ImageInput
    const file = imageFile('photo.png', 'image/png')
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
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="alt-cancel-test"></image-input>
        `)
        const el = await waitFor(
            'image-input.alt-cancel-test'
        ) as ImageInput
        const file = imageFile('photo.png', 'image/png')
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="alt-cancelable-test"></image-input>
    `)
    const el = await waitFor(
        'image-input.alt-cancelable-test'
    ) as ImageInput
    const file = imageFile('photo.png', 'image/png')
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="dialogs-render-test"></image-input>
    `)
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="alt-dialog-structure-test"></image-input>
    `)
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="crop-dialog-structure-test"></image-input>
    `)
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="dialog-a11y-test"></image-input>
    `)
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="dupe-a"></image-input>
        <image-input class="dupe-b"></image-input>
    `)
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
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="label-default-test"></image-input>
        `)
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
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="label-set-test"></image-input>
    `)
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

test('render() and html() produce the same markup', async t => {
    // Reassign ImageInput.TEXT to something other than DEFAULT_TEXT
    // before rendering, and restore it in `finally` even if an
    // assertion below fails. Passing `text: ImageInput.TEXT` to
    // html() below only proves render() forwards the option if the
    // two sides can actually disagree -- with TEXT left untouched,
    // html()'s own DEFAULT_TEXT fallback is value-identical to it,
    // and a render() that dropped the option entirely would still
    // pass here by coincidence.
    const originalText = ImageInput.TEXT
    ImageInput.TEXT = { ...originalText, cropHeading: 'Custom crop heading' }

    try {
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="parity-test" accept="image/png"
                name="photo" required></image-input>
        `)
        const el = await waitFor('image-input.parity-test') as ImageInput

        const fromHtml = document.createElement('div')
        fromHtml.innerHTML = html({
            accept: 'image/png',
            name: 'photo',
            required: true,
            text: ImageInput.TEXT
        })

        t.ok(el.querySelector('.box'), 'the element should render a box')
        t.ok(el.querySelector('.alt-dialog'),
            'the element should still render the alt dialog')
        t.ok(el.querySelector('.crop-dialog'),
            'the element should still render the crop dialog')

        // Compare the whole rendered subtree, not just the box. Both
        // sides are browser-serialized from the same parse path, so
        // this is an exact comparison -- which is the point. A drift
        // anywhere, including in the whitespace between the two
        // dialogs, fails here. That is the lock this task installs.
        t.equal(el.innerHTML, fromHtml.innerHTML,
            'the element and html() should emit identical markup')
    } finally {
        ImageInput.TEXT = originalText
    }
})

test('render() and html() produce the same markup with alt and ' +
    'label set', async t => {
    // The all-defaults case above never exercises the branchy
    // interpolations -- the alt-badge's has-alt class, the hasAlt
    // aria-label ternary, and the label fallback. Set alt and label
    // so the lock covers those branches too, not just the trunk.
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="parity-alt-label-test" accept="image/png"
            name="photo" required alt="a cat" label="Drop here"
        ></image-input>
    `)
    const el = await waitFor(
        'image-input.parity-alt-label-test'
    ) as ImageInput

    const fromHtml = document.createElement('div')
    fromHtml.innerHTML = html({
        accept: 'image/png',
        name: 'photo',
        required: true,
        alt: 'a cat',
        label: 'Drop here',
        text: ImageInput.TEXT
    })

    t.equal(el.innerHTML, fromHtml.innerHTML,
        'the element and html() should emit identical markup ' +
        'when alt and label are set')
})

// Tests for stored source (Phase 4)
const URL1 = '/fixtures/photo.png'

test('AC1.1: Setting src shows image with no events', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="stored-src-ac1-1"></image-input>
    `)
    const el = await waitFor('image-input.stored-src-ac1-1') as ImageInput

    const events:string[] = []
    el.addEventListener('image-input:change', () => {
        events.push('change')
    })
    el.addEventListener('image-input:alt-change', () => {
        events.push('alt-change')
    })
    el.addEventListener('image-input:remove', () => {
        events.push('remove')
    })

    el.src = URL1
    await new Promise(_resolve => setTimeout(_resolve, 0))

    t.equal(el.querySelector('.box')?.classList.contains('has-image'),
        true, '.box should have has-image')
    t.equal(el.querySelector('.preview')?.classList.contains('has-image'),
        true, '.preview should have has-image')
    t.equal(
        el.querySelector('.preview img')?.getAttribute('src'),
        URL1,
        'preview img.src should be the URL'
    )
    t.equal(events.length, 0, 'no events should fire')
})

test('AC1.1 seeded: parsing src shows image with no events',
    async t => {
        const container = document.createElement('div')
        document.body.appendChild(container)

        const events:string[] = []
        container.addEventListener('image-input:change', () => {
            events.push('change')
        })
        container.addEventListener('image-input:alt-change', () => {
            events.push('alt-change')
        })
        container.addEventListener('image-input:remove', () => {
            events.push('remove')
        })

        container.insertAdjacentHTML('beforeend',
            `<image-input class="stored-src-ac1-1-seeded"
                src="${URL1}"></image-input>`)

        const el = await waitFor(
            'image-input.stored-src-ac1-1-seeded'
        ) as ImageInput
        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.equal(
            el.querySelector('.box')?.classList.contains('has-image'),
            true, '.box should have has-image'
        )
        t.equal(
            el.querySelector('.preview')?.classList.contains('has-image'),
            true, '.preview should have has-image'
        )
        t.equal(events.length, 0, 'no events should fire')
    })

test('AC1.2: After setting src, input.files is empty', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="stored-src-ac1-2"></image-input>
    `)
    const el = await waitFor('image-input.stored-src-ac1-2') as ImageInput
    const input = el.querySelector(
        'input[type="file"]'
    ) as HTMLInputElement

    el.src = URL1
    await new Promise(_resolve => setTimeout(_resolve, 0))

    t.equal(input.files?.length ?? 0, 0,
        'input.files should be empty after setting src')
})

test('AC1.3: Setting src while file is held drops the file',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="stored-src-ac1-3"></image-input>
        `)
        const el = await waitFor('image-input.stored-src-ac1-3') as ImageInput
        const input = el.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement
        const file = imageFile('a.png', 'image/png')

        selectFile(el, file)
        await new Promise(_resolve => setTimeout(_resolve, 0))

        const events:string[] = []
        el.addEventListener('image-input:change', () => {
            events.push('change')
        })
        el.addEventListener('image-input:alt-change', () => {
            events.push('alt-change')
        })
        el.addEventListener('image-input:remove', () => {
            events.push('remove')
        })

        el.src = URL1
        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.equal(input.files?.length ?? 0, 0,
            'input.files should be empty')
        t.equal(
            el.querySelector('.preview img')?.getAttribute('src'),
            URL1,
            'preview should show the URL'
        )
        t.equal(events.length, 0, 'no events should fire')
    })

test('AC1.4: Empty src shows no image', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="stored-src-ac1-4a" src="${URL1}"></image-input>
    `)
    const el = await waitFor('image-input.stored-src-ac1-4a') as ImageInput

    const events:string[] = []
    el.addEventListener('image-input:change', () => {
        events.push('change')
    })
    el.addEventListener('image-input:alt-change', () => {
        events.push('alt-change')
    })
    el.addEventListener('image-input:remove', () => {
        events.push('remove')
    })

    el.setAttribute('src', '')
    await new Promise(_resolve => setTimeout(_resolve, 0))

    t.equal(el.querySelector('.box')?.classList.contains('has-image'),
        false, '.box should not have has-image')
    t.equal(el.querySelector('.preview')?.classList.contains('has-image'),
        false, '.preview should not have has-image')
    const img = el.querySelector('.preview img') as HTMLImageElement
    t.ok(img, 'preview img should exist')
    t.equal(img.hasAttribute('src'), false, 'preview img should have no src')
    t.equal(events.length, 0, 'no events should fire')

    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="stored-src-ac1-4b" src="${URL1}"></image-input>
    `)
    const el2 = await waitFor('image-input.stored-src-ac1-4b') as ImageInput

    const events2:string[] = []
    el2.addEventListener('image-input:change', () => {
        events2.push('change')
    })
    el2.addEventListener('image-input:alt-change', () => {
        events2.push('alt-change')
    })
    el2.addEventListener('image-input:remove', () => {
        events2.push('remove')
    })

    el2.src = ''
    await new Promise(_resolve => setTimeout(_resolve, 0))

    t.equal(el2.querySelector('.box')?.classList.contains('has-image'),
        false, '.box should not have has-image when src is empty string')
    t.equal(el2.querySelector('.preview')?.classList.contains('has-image'),
        false, '.preview should not have has-image when src is empty string')
    const img2 = el2.querySelector('.preview img') as HTMLImageElement
    t.ok(img2, 'preview img should exist for el2')
    t.equal(img2.hasAttribute('src'), false, 'img should have no src for el2')
    t.equal(events2.length, 0, 'no events should fire for el2')
})

test('AC1.5: Removing src with no file empties preview, no events',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="stored-src-ac1-5a" src="${URL1}"></image-input>
        `)
        const el = await waitFor('image-input.stored-src-ac1-5a') as ImageInput

        const events:string[] = []
        el.addEventListener('image-input:change', () => {
            events.push('change')
        })
        el.addEventListener('image-input:alt-change', () => {
            events.push('alt-change')
        })
        el.addEventListener('image-input:remove', () => {
            events.push('remove')
        })

        el.src = null
        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.equal(el.querySelector('.box')?.classList.contains('has-image'),
            false, '.box should not have has-image')
        const img = el.querySelector('.preview img') as HTMLImageElement
        t.ok(img, 'preview img should exist')
        t.equal(img.hasAttribute('src'), false,
            'preview img should have no src')
        t.equal(events.length, 0, 'no events should fire')
    })

test('AC1.5 with file held: Removing src leaves file in place',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="stored-src-ac1-5b"></image-input>
        `)
        const el = await waitFor('image-input.stored-src-ac1-5b') as ImageInput
        const input = el.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement
        const file = imageFile('a.png', 'image/png')

        selectFile(el, file)
        await new Promise(_resolve => setTimeout(_resolve, 0))

        const events:string[] = []
        el.addEventListener('image-input:change', () => {
            events.push('change')
        })
        el.addEventListener('image-input:alt-change', () => {
            events.push('alt-change')
        })
        el.addEventListener('image-input:remove', () => {
            events.push('remove')
        })

        el.src = ''
        await new Promise(_resolve => setTimeout(_resolve, 0))
        t.equal(events.length, 0, 'no events should fire')

        const previewImg = el.querySelector('.preview img')
        t.equal(el.querySelector('.box')?.classList.contains('has-image'),
            true, '.box should have has-image')
        t.ok(previewImg?.getAttribute('src')?.startsWith('blob:'),
            'preview img src should start with blob:')
        t.equal(input.files?.length, 1,
            'input.files should still hold the file')

        el.removeAttribute('src')
        await new Promise(_resolve => setTimeout(_resolve, 0))
        t.equal(events.length, 0, 'no events should fire')

        t.equal(el.querySelector('.box')?.classList.contains('has-image'),
            true, '.box should still have has-image')
        t.ok(el.querySelector('.preview img')?.getAttribute('src')
            ?.startsWith('blob:'), 'preview img src should still be blob:')
        t.equal(input.files?.length, 1,
            'input.files should still hold the file')
    })

test('Remove on a stored image clears src and emits remove', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="stored-src-ac1-6" src="${URL1}"></image-input>
    `)
    const el = await waitFor('image-input.stored-src-ac1-6') as ImageInput

    let removeEmitted = false
    el.addEventListener('image-input:remove', () => {
        removeEmitted = true
    })

    const removeBtn = el.querySelector('.remove') as HTMLElement
    removeBtn.click()
    await new Promise(_resolve => setTimeout(_resolve, 0))

    t.equal(removeEmitted, true, 'remove should emit')
    t.equal(el.querySelector('.box')?.classList.contains('has-image'),
        false, '.box should lose has-image')
    t.equal(el.querySelector('.preview')?.classList.contains('has-image'),
        false, '.preview should lose has-image')
    const img = el.querySelector('.preview img') as HTMLImageElement
    t.ok(img, 'preview img should exist')
    t.equal(img.hasAttribute('src'), false, 'preview img should have no src')
    t.equal(el.hasAttribute('src'), false,
        'src attribute should be removed')
})

test('AC1.6: Picking while src is set emits change with source pick',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="stored-src-ac1-6-pick" src="${URL1}">
            </image-input>
        `)
        const el = await waitFor(
            'image-input.stored-src-ac1-6-pick'
        ) as ImageInput
        const file = imageFile('b.png', 'image/png')

        let detail:ImageInputEventMap['change']['detail']|undefined
        el.addEventListener('image-input:change', (ev:Event) => {
            detail = (ev as CustomEvent).detail
        })

        selectFile(el, file)
        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.equal(detail?.source, 'pick',
            'source should be pick')
        t.equal(el.hasAttribute('src'), false,
            'src attribute should be removed')
        t.ok(el.querySelector('.preview img')?.getAttribute('src')
            ?.startsWith('blob:'), 'preview src should be blob:')
    })

test('AC1.6: Dropping while src is set emits change with source drop',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="stored-src-ac1-6-drop" src="${URL1}">
            </image-input>
        `)
        const el = await waitFor(
            'image-input.stored-src-ac1-6-drop'
        ) as ImageInput
        const box = el.querySelector('.box') as HTMLElement
        const file = imageFile('c.png', 'image/png')

        let detail:ImageInputEventMap['change']['detail']|undefined
        el.addEventListener('image-input:change', (ev:Event) => {
            detail = (ev as CustomEvent).detail
        })

        const dt = new DataTransfer()
        dt.items.add(file)
        box.dispatchEvent(new DragEvent('drop', {
            dataTransfer: dt,
            bubbles: true,
            cancelable: true
        }))
        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.equal(detail?.source, 'drop',
            'source should be drop')
        t.equal(el.hasAttribute('src'), false,
            'src attribute should be removed')
        t.ok(el.querySelector('.preview img')?.getAttribute('src')
            ?.startsWith('blob:'), 'preview src should be blob:')
    })

test('AC1.7: required with src-only image keeps input not required',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="stored-src-ac1-7a" required
                src="${URL1}"></image-input>
        `)
        const el = await waitFor(
            'image-input.stored-src-ac1-7a'
        ) as ImageInput
        const input = el.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement

        t.equal(input.required, false,
            'input should not be required when src is set')
        t.equal(input.hasAttribute('data-required'), true,
            'input should have data-required')
    })

test('AC1.7: After Remove, input becomes required again', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="stored-src-ac1-7b" required
            src="${URL1}"></image-input>
    `)
    const el = await waitFor('image-input.stored-src-ac1-7b') as ImageInput
    const input = el.querySelector(
        'input[type="file"]'
    ) as HTMLInputElement

    const removeBtn = el.querySelector('.remove') as HTMLElement
    removeBtn.click()
    await new Promise(_resolve => setTimeout(_resolve, 0))

    t.equal(input.required, true,
        'input should be required after removing src')
})

test('AC1.7: After clear(), input is required', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="stored-src-ac1-7c" required
            src="${URL1}"></image-input>
    `)
    const el = await waitFor('image-input.stored-src-ac1-7c') as ImageInput
    const input = el.querySelector(
        'input[type="file"]'
    ) as HTMLInputElement

    el.clear()
    await new Promise(_resolve => setTimeout(_resolve, 0))

    t.equal(input.required, true,
        'input should be required after clear()')
})

test('AC1.7: Without required, input is never required', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="stored-src-ac1-7d"></image-input>
    `)
    const el = await waitFor('image-input.stored-src-ac1-7d') as ImageInput
    const input = el.querySelector(
        'input[type="file"]'
    ) as HTMLInputElement

    t.equal(input.required, false,
        'input should not be required when element has no required')

    el.src = URL1
    await new Promise(_resolve => setTimeout(_resolve, 0))

    t.equal(input.required, false,
        'input should not be required when src is set and no required')

    el.src = null
    await new Promise(_resolve => setTimeout(_resolve, 0))

    t.equal(input.required, false,
        'input should not be required after removing src without required')
})

test('AC1.7: Runtime required with src: setting src makes input not required',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="stored-src-ac1-7-runtime" required>
            </image-input>
        `)
        const el = await waitFor(
            'image-input.stored-src-ac1-7-runtime'
        ) as ImageInput
        const input = el.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement

        t.equal(input.required, true, 'input is required with no src')

        el.src = URL1
        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.equal(input.required, false,
            'input should not be required when src is set')
        t.equal(input.hasAttribute('data-required'), true,
            'input should have data-required')

        el.required = false
        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.equal(input.required, false,
            'input should not be required when required is toggled off')

        el.required = true
        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.equal(input.required, false,
            'input should stay not required when src is set, even when '
            + 'required is set back to true')
    })

test('AC1.8: Runtime crossorigin: setting crossorigin updates img attribute',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="stored-src-ac1-8-runtime" src="${URL1}">
            </image-input>
        `)
        const el = await waitFor(
            'image-input.stored-src-ac1-8-runtime'
        ) as ImageInput
        const img = el.querySelector('.preview img') as HTMLImageElement

        t.equal(img.hasAttribute('crossorigin'), false,
            'img should have no crossorigin initially')

        el.crossorigin = 'anonymous'
        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.equal(img.crossOrigin, 'anonymous',
            'img.crossOrigin should be anonymous after setting')

        el.crossorigin = null
        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.equal(img.hasAttribute('crossorigin'), false,
            'img should have no crossorigin after setting to null')
    })

test('AC1.8: crossorigin is applied to preview img', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="stored-src-ac1-8" crossorigin="anonymous"
            src="${URL1}"></image-input>
    `)
    const el = await waitFor('image-input.stored-src-ac1-8') as ImageInput
    const img = el.querySelector('.preview img') as HTMLImageElement

    t.equal(img.crossOrigin, 'anonymous',
        'img.crossOrigin should match the crossorigin attribute')
})

test('AC2.1: ALT on stored image emits alt event', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="stored-src-ac2-1" src="${URL1}"></image-input>
    `)
    const el = await waitFor('image-input.stored-src-ac2-1') as ImageInput

    let altDetail:ImageInputEventMap['alt']['detail']|undefined
    el.addEventListener('image-input:alt', (ev:Event) => {
        altDetail = (ev as CustomEvent).detail
    })

    const altBadge = el.querySelector('.alt-badge') as HTMLElement
    altBadge.click()
    await new Promise(_resolve => setTimeout(_resolve, 0))

    t.deepEqual(altDetail, { file: null, src: URL1, alt: '' },
        'alt event detail should have file:null, src, and empty alt')

    const dialog = el.querySelector('.alt-dialog') as HTMLDialogElement
    t.equal(dialog.open, true, '.alt-dialog should be open')
})

test('AC2.1: Saving ALT on stored image emits alt-change, not change',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="stored-src-ac2-1-save" src="${URL1}">
            </image-input>
        `)
        const el = await waitFor(
            'image-input.stored-src-ac2-1-save'
        ) as ImageInput

        let changeEmitted = false
        let altChangeEmitted = false
        el.addEventListener('image-input:change', () => {
            changeEmitted = true
        })
        el.addEventListener('image-input:alt-change', () => {
            altChangeEmitted = true
        })

        const altBadge = el.querySelector('.alt-badge') as HTMLElement
        altBadge.click()
        await new Promise(_resolve => setTimeout(_resolve, 0))

        const textarea = el.querySelector(
            '.alt-dialog textarea'
        ) as HTMLTextAreaElement
        textarea.value = 'A new alt'

        const saveBtn = el.querySelector('.alt-save') as HTMLElement
        saveBtn.click()
        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.equal(altChangeEmitted, true, 'alt-change should emit')
        t.equal(changeEmitted, false, 'change should not emit')
    })

test('ALT event detail with held file has src === null',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
            <image-input class="alt-event-held-file"></image-input>
        `)
        const el = await waitFor(
            'image-input.alt-event-held-file'
        ) as ImageInput
        const file = imageFile('photo.png', 'image/png')
        selectFile(el, file)

        let detail:ImageInputEventMap['alt']['detail']|undefined
        el.addEventListener('image-input:alt', (ev:Event) => {
            detail = (ev as CustomEvent).detail
        })

        const altBadge = el.querySelector('.alt-badge') as HTMLButtonElement
        altBadge.click()

        t.ok(detail?.file === file,
            'detail.file should be the held file')
        t.ok(detail?.src === null,
            'detail.src should be null for held file')
        t.equal(detail?.alt, '',
            'detail.alt should be empty string')
    })

test('AC5.1: Seeded alt emits no alt-change at parse time',
    async t => {
        const container = document.createElement('div')
        document.body.appendChild(container)

        let altChangeEmitted = false
        container.addEventListener('image-input:alt-change', () => {
            altChangeEmitted = true
        })

        container.insertAdjacentHTML('beforeend', `
            <image-input class="stored-src-ac5-1" alt="seeded"
                src="${URL1}"></image-input>`)

        const el = await waitFor(
            'image-input.stored-src-ac5-1'
        ) as ImageInput
        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.equal(altChangeEmitted, false,
            'alt-change should not emit for seeded alt')
        t.equal(
            el.querySelector('.alt-badge')?.classList.contains('has-alt'),
            true,
            '.alt-badge should show has-alt'
        )
    })

test('AC5.2: Setting alt after connect emits alt-change', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="stored-src-ac5-2" src="${URL1}"></image-input>
    `)
    const el = await waitFor('image-input.stored-src-ac5-2') as ImageInput

    let altChangeDetail:ImageInputEventMap['alt-change']['detail']|undefined
    el.addEventListener('image-input:alt-change', (ev:Event) => {
        altChangeDetail = (ev as CustomEvent).detail
    })

    el.alt = 'x'
    await new Promise(_resolve => setTimeout(_resolve, 0))

    t.deepEqual(altChangeDetail, { alt: 'x' },
        'alt-change should emit with the new alt')
})

test('AC5.3: setImage emits change with source api', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="stored-src-ac5-3"></image-input>
    `)
    const el = await waitFor('image-input.stored-src-ac5-3') as ImageInput
    const blob = imageBlob('image/png')

    let changeDetail:ImageInputEventMap['change']['detail']|undefined
    el.addEventListener('image-input:change', (ev:Event) => {
        changeDetail = (ev as CustomEvent).detail
    })

    el.setImage(blob)
    await new Promise(_resolve => setTimeout(_resolve, 0))

    t.equal(changeDetail?.source, 'api',
        'change event should have source: api')
})

test('AC2.2 and plan test 12: edit() on a src-only image hands the ' +
    'URL to image-crop, saving emits change with source crop and a ' +
    'File named from the URL', async t => {
    document.body.insertAdjacentHTML('beforeend', `
    <image-input class="edit-src-ac2-2-test" src="/fixtures/photo.png">
    </image-input>
    `)
    const el = await waitFor('image-input.edit-src-ac2-2-test') as ImageInput
    const editBtn = el.querySelector('.edit') as HTMLButtonElement
    const cropDialog = el.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement

    editBtn.click()

    const cropEl = el.querySelector('image-crop') as ImageCrop
    t.equal(cropEl.getAttribute('src'), '/fixtures/photo.png',
        'image-crop should have the stored src')

    await waitForImageLoad(cropEl)

    const changed = new Promise<ImageInputEventMap['change']['detail']>(
        resolve => {
            el.addEventListener('image-input:change', ((ev:CustomEvent) => {
                resolve(ev.detail)
            }) as EventListener, { once: true })
        }
    )

    const saveBtn = cropDialog.querySelector(
        '.crop-save'
    ) as HTMLButtonElement
    saveBtn.click()
    const detail = await changed

    t.equal(detail.source, 'crop',
        'change should have source: crop')
    t.equal(detail.file.name, 'photo.png',
        'file name should come from the URL')
    t.equal(detail.file.type, 'image/png',
        'file type should be guessed from extension')
    t.equal(el.hasAttribute('src'), false,
        'src should be removed after saving')
})

test('plan test 12 fallback: editing a data URL generates a .jpg ' +
    'from a guessed image/jpeg type', async t => {
    document.body.insertAdjacentHTML('beforeend', `
    <image-input class="edit-data-url-test"></image-input>
    `)
    const el = await waitFor(
        'image-input.edit-data-url-test'
    ) as ImageInput
    const src = imageDataUrl()
    el.src = src

    const editBtn = el.querySelector('.edit') as HTMLButtonElement
    const cropDialog = el.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement
    editBtn.click()

    const cropEl = el.querySelector('image-crop') as ImageCrop
    await waitForImageLoad(cropEl)

    const changed = new Promise<ImageInputEventMap['change']['detail']>(
        resolve => {
            el.addEventListener('image-input:change', ((ev:CustomEvent) => {
                resolve(ev.detail)
            }) as EventListener, { once: true })
        }
    )

    const saveBtn = cropDialog.querySelector(
        '.crop-save'
    ) as HTMLButtonElement
    saveBtn.click()
    const detail = await changed

    t.equal(detail.file.type, 'image/jpeg',
        'data URL with no extension should default to image/jpeg')
    t.equal(detail.file.name, 'image.jpg',
        'file name should be image.jpg')
})

test('AC3.1: edit() on a file opens the dialog, emits edit with ' +
    '{file, src: null}, resolves after change with the cropped File, ' +
    'and change fires before the promise resolves', async t => {
    document.body.insertAdjacentHTML('beforeend', `
    <image-input class="edit-file-ac3-1"></image-input>
    `)
    const el = await waitFor('image-input.edit-file-ac3-1') as ImageInput
    const file = makeImageFile(200, 100)
    selectFile(el, await file)

    const events:string[] = []

    let editDetail:ImageInputEventMap['edit']['detail']|undefined
    el.addEventListener('image-input:edit', ((ev:CustomEvent) => {
        editDetail = ev.detail
        events.push('edit')
    }) as EventListener)

    let changeDetail:ImageInputEventMap['change']['detail']|undefined
    el.addEventListener('image-input:change', ((ev:CustomEvent) => {
        changeDetail = ev.detail
        events.push('change')
    }) as EventListener)

    const editPromise = el.edit()
    const cropDialog = el.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement
    t.equal(cropDialog.open, true, 'dialog should be open')

    t.equal(editDetail?.file instanceof File, true,
        'edit detail should have file')
    t.equal(editDetail?.src, null,
        'edit detail should have src: null for a file')

    const cropEl = el.querySelector('image-crop') as ImageCrop
    await waitForImageLoad(cropEl)

    const saveBtn = cropDialog.querySelector(
        '.crop-save'
    ) as HTMLButtonElement
    saveBtn.click()

    const resolved = await editPromise

    t.equal(resolved, changeDetail?.file,
        'promise should resolve with the same File as change detail')
    t.deepEqual(events, ['edit', 'change'],
        'change should fire before the promise resolves')
})

test('AC3.1 src-only variant: edit detail has {file: null, src: url}',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
        <image-input class="edit-src-detail-test" src="/fixtures/photo.png">
        </image-input>
    `)
        const el = await waitFor(
            'image-input.edit-src-detail-test'
        ) as ImageInput

        let editDetail:ImageInputEventMap['edit']['detail']|undefined
        el.addEventListener('image-input:edit', ((ev:CustomEvent) => {
            editDetail = ev.detail
        }) as EventListener)

        el.edit()

        t.equal(editDetail?.file, null,
            'file should be null for src-only')
        t.equal(editDetail?.src, '/fixtures/photo.png',
            'src should be the stored URL')
    })

test('AC3.2: edit() resolves null when cancel is clicked',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
        <image-input class="edit-cancel-test"></image-input>
    `)
        const el = await waitFor(
            'image-input.edit-cancel-test'
        ) as ImageInput
        const file = await makeImageFile(200, 100)
        selectFile(el, file)

        const editPromise = el.edit()
        const cropDialog = el.querySelector(
            '.crop-dialog'
        ) as HTMLDialogElement
        const cancelBtn = cropDialog.querySelector(
            '.crop-cancel'
        ) as HTMLButtonElement

        cancelBtn.click()
        const result = await editPromise

        t.equal(result, null, 'promise should resolve null')
        t.equal(cropDialog.open, false, 'dialog should be closed')
    })

test('AC3.2 Esc closes the dialog and resolves edit() to null',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
        <image-input class="edit-esc-test"></image-input>
    `)
        const el = await waitFor('image-input.edit-esc-test') as ImageInput
        const file = await makeImageFile(200, 100)
        selectFile(el, file)

        const editPromise = el.edit()
        const cropDialog = el.querySelector(
            '.crop-dialog'
        ) as HTMLDialogElement
        t.equal(cropDialog.open, true, 'sanity: dialog is open')

        cropDialog.close()
        const result = await editPromise

        t.equal(result, null, 'promise should resolve null')
        t.equal(cropDialog.open, false, 'dialog should be closed')
    })

test('AC3.2 stale close: close event from previous session does not ' +
    'settle a new edit() session', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="stale-close-test"></image-input>
    `)
    const el = await waitFor('image-input.stale-close-test') as ImageInput
    const file = await makeImageFile(200, 100)
    selectFile(el, file)

    const p1 = el.edit()
    const cropDialog = el.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement

    const cropEl = el.querySelector('image-crop') as ImageCrop
    await waitForImageLoad(cropEl)

    const saveBtn = cropDialog.querySelector(
        '.crop-save'
    ) as HTMLButtonElement
    saveBtn.click()

    await p1

    const p2 = el.edit()
    t.equal(cropDialog.open, true,
        'sanity: dialog reopened for second session')

    await new Promise(_resolve => setTimeout(_resolve, 0))

    t.equal(p2.constructor.name, 'Promise',
        'p2 should still be pending after stale close task')
    t.equal(cropDialog.open, true,
        'dialog should still be open after stale close task')

    const cancelBtn = cropDialog.querySelector(
        '.crop-cancel'
    ) as HTMLButtonElement
    cancelBtn.click()
    const result = await p2

    t.equal(result, null, 'p2 should resolve null')
})

test('in-flight save across sessions: blob from previous Save does ' +
    'not settle previous session, new session stays pending', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="inflight-save-test"></image-input>
    `)
    const el = await waitFor(
        'image-input.inflight-save-test'
    ) as ImageInput
    const file = await makeImageFile(200, 100)
    selectFile(el, file)

    const a = el.edit()
    const cropDialog = el.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement
    const cropEl = el.querySelector('image-crop') as ImageCrop
    await waitForImageLoad(cropEl)

    let deferredResolve:(blob:Blob) => void = () => {}
    const deferred = new Promise<Blob>(resolve => {
        deferredResolve = resolve
    })

    try {
        cropEl.getBlob = (() => deferred) as any

        const saveBtn = cropDialog.querySelector(
            '.crop-save'
        ) as HTMLButtonElement
        saveBtn.click()

        cropDialog.close()

        const b = el.edit()
        t.notEqual(a, b, 'new session should have a new promise')

        const blob = await imageBlob('image/png')
        deferredResolve(blob)

        await new Promise(_resolve => setTimeout(_resolve, 0))
        let aResolved = false
        a.then(() => { aResolved = true })
        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.equal(aResolved, true, 'session a should resolve')

        let bResolved = false
        b.then(() => { bResolved = true })
        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.equal(bResolved, false,
            'session b should still be pending after timeout')

        const cancelBtn = cropDialog.querySelector(
            '.crop-cancel'
        ) as HTMLButtonElement
        cancelBtn.click()
        const result = await b

        t.equal(result, null, 'session b should resolve null')
    } finally {
        Reflect.deleteProperty(cropEl, 'getBlob')
    }
})

test('close then edit in one tick: close from previous session does ' +
    'not prevent opening new session', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="close-then-edit-test"></image-input>
    `)
    const el = await waitFor(
        'image-input.close-then-edit-test'
    ) as ImageInput
    const file = await makeImageFile(200, 100)
    selectFile(el, file)

    const a = el.edit()
    const cropDialog = el.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement

    cropDialog.close()
    const b = el.edit()

    t.notEqual(a, b, 'should have two distinct promises')
    t.equal(cropDialog.open, true, 'dialog should be open')

    const cancelBtn = cropDialog.querySelector(
        '.crop-cancel'
    ) as HTMLButtonElement
    cancelBtn.click()

    const resultA = await a
    const resultB = await b

    t.equal(resultA, null, 'session a should resolve null')
    t.equal(resultB, null, 'session b should resolve null')
})

test('AC3.3: edit() returns null immediately when nocrop is set',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
        <image-input class="nocrop-test" nocrop></image-input>
    `)
        const el = await waitFor('image-input.nocrop-test') as ImageInput
        const file = await makeImageFile(200, 100)
        selectFile(el, file)

        const result = await el.edit()

        t.equal(result, null, 'should resolve null immediately')

        const cropDialog = el.querySelector(
            '.crop-dialog'
        ) as HTMLDialogElement
        t.equal(cropDialog.open, false, 'dialog should stay closed')
    })

test('AC3.3: edit() returns null immediately when there is no image',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
        <image-input class="no-image-test"></image-input>
    `)
        const el = await waitFor('image-input.no-image-test') as ImageInput

        const result = await el.edit()

        t.equal(result, null, 'should resolve null immediately')

        const cropDialog = el.querySelector(
            '.crop-dialog'
        ) as HTMLDialogElement
        t.equal(cropDialog.open, false, 'dialog should stay closed')
    })

test('AC3.3: edit() returns null when a listener calls ' +
    'preventDefault() on the edit event', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="edit-prevented-test"></image-input>
    `)
    const el = await waitFor(
        'image-input.edit-prevented-test'
    ) as ImageInput
    const file = await makeImageFile(200, 100)
    selectFile(el, file)

    el.addEventListener('image-input:edit', (ev:Event) => {
        ev.preventDefault()
    })

    const result = await el.edit()

    t.equal(result, null, 'should resolve null')

    const cropDialog = el.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement
    t.equal(cropDialog.open, false, 'dialog should stay closed')
})

test('AC3.4: calling edit() twice while dialog is open returns the ' +
    'same promise', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-input class="reuse-promise-test"></image-input>
    `)
    const el = await waitFor(
        'image-input.reuse-promise-test'
    ) as ImageInput
    const file = await makeImageFile(200, 100)
    selectFile(el, file)

    const p1 = el.edit()
    const p2 = el.edit()

    t.equal(p1, p2, 'should return the same promise')

    let editEventCount = 0
    el.addEventListener('image-input:edit', () => {
        editEventCount++
    })

    el.edit()

    t.equal(editEventCount, 0,
        'additional edit() calls should not fire edit event')

    const cropDialog = el.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement
    const cancelBtn = cropDialog.querySelector(
        '.crop-cancel'
    ) as HTMLButtonElement
    cancelBtn.click()

    await p1
})

test('AC3.5: clicking the edit button has the same effect as calling ' +
    'edit()', async t => {
    document.body.insertAdjacentHTML('beforeend', `
            <image-input class="click-edit-test"></image-input>
        `)
    const el = await waitFor('image-input.click-edit-test') as ImageInput
    const file = await makeImageFile(200, 100)
    selectFile(el, file)

    let editDetail:ImageInputEventMap['edit']['detail']|undefined
    el.addEventListener('image-input:edit', ((ev:CustomEvent) => {
        editDetail = ev.detail
    }) as EventListener)

    const editBtn = el.querySelector('.edit') as HTMLButtonElement
    editBtn.click()

    const cropDialog = el.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement
    t.equal(cropDialog.open, true, 'dialog should open')
    t.equal(editDetail?.file instanceof File, true,
        'should emit edit with file detail')

    const cropEl = el.querySelector('image-crop') as ImageCrop
    await waitForImageLoad(cropEl)

    const changed = new Promise<ImageInputEventMap['change']['detail']>(
        resolve => {
            el.addEventListener('image-input:change', ((ev:CustomEvent) => {
                resolve(ev.detail)
            }) as EventListener, { once: true })
        }
    )

    const saveBtn = cropDialog.querySelector(
        '.crop-save'
    ) as HTMLButtonElement
    saveBtn.click()

    const detail = await changed

    t.equal(detail.source, 'crop',
        'saving should emit change with source: crop')
})

test('AC4.1: when getBlob() rejects, error is emitted with ' +
    'reason crop-failed, dialog stays open, image unchanged, no ' +
    'change emitted', async t => {
    document.body.insertAdjacentHTML('beforeend', `
            <image-input class="crop-failed-test"></image-input>
        `)
    const el = await waitFor(
        'image-input.crop-failed-test'
    ) as ImageInput
    const file = await makeImageFile(200, 100)
    selectFile(el, file)

    el.edit()

    const cropDialog = el.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement
    const cropEl = el.querySelector('image-crop') as ImageCrop
    await waitForImageLoad(cropEl)

    const imgBefore = el.querySelector('img') as HTMLImageElement
    const srcBefore = imgBefore.getAttribute('src')

    try {
        cropEl.getBlob = (() => Promise.reject(
            new Error('tainted')
        )) as any

        let errorReason:ImageInputEventMap['error']['detail']['reason']|
            undefined
        el.addEventListener('image-input:error', ((ev:CustomEvent) => {
            errorReason = ev.detail.reason
        }) as EventListener)

        let changeCount = 0
        el.addEventListener('image-input:change', () => {
            changeCount++
        })

        const saveBtn = cropDialog.querySelector(
            '.crop-save'
        ) as HTMLButtonElement
        saveBtn.click()

        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.equal(errorReason, 'crop-failed',
            'should emit error with reason crop-failed')
        t.equal(cropDialog.open, true,
            'dialog should stay open')
        t.equal(el.querySelector('img')?.getAttribute('src'),
            srcBefore,
            'preview src should be unchanged')
        t.equal(changeCount, 0, 'no change should be emitted')
    } finally {
        Reflect.deleteProperty(cropEl, 'getBlob')
    }
})

test('AC4.2: failed save does not settle edit() promise, ' +
    'later cancel resolves it null', async t => {
    document.body.insertAdjacentHTML('beforeend', `
            <image-input class="failed-then-cancel-test"></image-input>
        `)
    const el = await waitFor(
        'image-input.failed-then-cancel-test'
    ) as ImageInput
    const file = await makeImageFile(200, 100)
    selectFile(el, file)

    const editPromise = el.edit()

    const cropDialog = el.querySelector(
        '.crop-dialog'
    ) as HTMLDialogElement
    const cropEl = el.querySelector('image-crop') as ImageCrop
    await waitForImageLoad(cropEl)

    try {
        cropEl.getBlob = (() => Promise.reject(
            new Error('tainted')
        )) as any

        const saveBtn = cropDialog.querySelector(
            '.crop-save'
        ) as HTMLButtonElement
        saveBtn.click()

        await new Promise(_resolve => setTimeout(_resolve, 0))

        let editPending = true
        editPromise.then(() => { editPending = false })
        await new Promise(_resolve => setTimeout(_resolve, 0))

        t.equal(editPending, true,
            'promise should still be pending after failed save')

        const cancelBtn = cropDialog.querySelector(
            '.crop-cancel'
        ) as HTMLButtonElement
        cancelBtn.click()

        const result = await editPromise

        t.equal(result, null, 'cancel should resolve the promise null')
    } finally {
        Reflect.deleteProperty(cropEl, 'getBlob')
    }
})

test('ImageCrop is reachable from the package root', t => {
    t.equal(typeof RootImageCrop, 'function',
        'the root module should export the ImageCrop class')
    t.equal(RootImageCrop.TAG, 'image-crop',
        'and it should be the real one')
})

test('all done', () => {
    // tapout closes the browser as soon as this is set, instead of
    // waiting out the inactivity timeout.
    // @ts-expect-error tests
    window.testsFinished = true
})
