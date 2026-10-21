import { test } from '@substrate-system/tapzero'
import { waitFor } from '@substrate-system/dom'
import '../src/crop.js'
import type { CropRect, ImageCrop } from '../src/crop.js'
import {
    makeImageFile,
    makeTransparentFile,
    pixelAt,
    waitForImageLoad
} from './helpers.js'
import { containRatioRect, fitRatioRect } from '../src/crop-math.js'

test('example test', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="test"></image-crop>
    `)
    const el = await waitFor('image-crop')
    t.ok(el, 'should find an element')
})

test('accepts an image via setFile and renders it at a size that ' +
    'fits the element, preserving aspect ratio', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="setfile-test" style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.setfile-test') as ImageCrop
    const file = await makeImageFile(400, 200)
    el.setFile(file)
    await waitForImageLoad(el)

    const frame = el.querySelector('.image-crop-frame') as HTMLElement
    const frameHeight = parseFloat(frame.style.height)

    t.equal(frameHeight, 100,
        'should size the frame to preserve the 2:1 aspect ratio at ' +
        '200px wide')
})

test('accepts an image via the src attribute', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="src-test"></image-crop>
    `)
    const el = await waitFor('image-crop.src-test') as ImageCrop
    const file = await makeImageFile(10, 10)
    el.src = URL.createObjectURL(file)

    const img = el.querySelector('img') as HTMLImageElement
    t.ok(img.getAttribute('src'), 'should set the img src from the src attribute')
})

test('renders a crop rectangle with 8 handles, covering the full ' +
    'image initially', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="rect-test" style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.rect-test') as ImageCrop
    const file = await makeImageFile(200, 100)
    el.setFile(file)
    await waitForImageLoad(el)

    const handles = el.querySelectorAll('.handle')
    t.equal(handles.length, 8, 'should render 8 handles')

    const rect = el.querySelector('.crop-rect') as HTMLElement
    const frame = el.querySelector('.image-crop-frame') as HTMLElement

    t.equal(rect.style.left, '0px',
        'crop rect should start at the left edge of the image')
    t.equal(rect.style.top, '0px',
        'crop rect should start at the top edge of the image')
    t.equal(parseFloat(rect.style.width), frame.clientWidth,
        'crop rect should cover the full displayed image width')
    t.equal(parseFloat(rect.style.height), parseFloat(frame.style.height),
        'crop rect should cover the full displayed image height')
})

test('the crop rectangle opts out of the browser\'s own touch ' +
    'gestures', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="touch-test" style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.touch-test') as ImageCrop
    const file = await makeImageFile(200, 100)
    el.setFile(file)
    await waitForImageLoad(el)

    const rect = el.querySelector('.crop-rect') as HTMLElement

    t.equal(getComputedStyle(rect).touchAction, 'none',
        'the crop rect should set touch-action: none, so a touch drag ' +
        'is not stolen by the page as a pan and cancelled')

    // `touch-action` is not inherited, but the behavior for a touch is
    // the intersection of the hit element's value with its ancestors',
    // so the one declaration on `.crop-rect` covers every handle
    // inside it. That only holds while the handles stay descendants.
    const handles = Array.from(el.querySelectorAll<HTMLElement>('.handle'))
    t.equal(handles.length, 8, 'should find the 8 handles')
    t.ok(handles.every(h => h.closest('.crop-rect') === rect),
        'every handle should be a descendant of the crop rect, so the ' +
        'rect\'s touch-action applies to it too')
})

test('dims the area outside the crop rectangle', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="dim-test" style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.dim-test') as ImageCrop
    const file = await makeImageFile(200, 100)
    el.setFile(file)
    await waitForImageLoad(el)

    const top = el.querySelector('.dim-top') as HTMLElement
    const bottom = el.querySelector('.dim-bottom') as HTMLElement
    const left = el.querySelector('.dim-left') as HTMLElement
    const right = el.querySelector('.dim-right') as HTMLElement

    t.ok(top && bottom && left && right,
        'should render four dimming panels around the crop')

    t.equal(parseFloat(top.style.height), 0,
        'top dim panel should be empty when the crop covers the ' +
        'full image')
    t.equal(parseFloat(left.style.width), 0,
        'left dim panel should be empty when the crop covers the ' +
        'full image')
})

function pointer (
    type:string,
    clientX:number,
    clientY:number,
    pointerId = 1
):PointerEvent {
    return new PointerEvent(type, {
        clientX,
        clientY,
        pointerId,
        bubbles: true,
        cancelable: true
    })
}

test('dragging a corner handle resizes the crop rectangle', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="resize-test" style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.resize-test') as ImageCrop
    const file = await makeImageFile(200, 100)
    el.setFile(file)
    await waitForImageLoad(el)

    const frame = el.querySelector('.image-crop-frame') as HTMLElement
    const frameRect = frame.getBoundingClientRect()
    const handle = el.querySelector('.handle-nw') as HTMLElement

    handle.dispatchEvent(pointer('pointerdown', frameRect.left, frameRect.top))
    window.dispatchEvent(
        pointer('pointermove', frameRect.left + 20, frameRect.top + 10)
    )
    window.dispatchEvent(
        pointer('pointerup', frameRect.left + 20, frameRect.top + 10)
    )

    const rectEl = el.querySelector('.crop-rect') as HTMLElement
    t.equal(parseFloat(rectEl.style.left), 20,
        'left should move by the drag delta')
    t.equal(parseFloat(rectEl.style.top), 10,
        'top should move by the drag delta')
    t.equal(parseFloat(rectEl.style.width), 180,
        'width should shrink to compensate')
    t.equal(parseFloat(rectEl.style.height), 90,
        'height should shrink to compensate')
})

test('the crop rectangle cannot be resized below the minimum size', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="minsize-test" style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.minsize-test') as ImageCrop
    const file = await makeImageFile(200, 100)
    el.setFile(file)
    await waitForImageLoad(el)

    const frame = el.querySelector('.image-crop-frame') as HTMLElement
    const frameRect = frame.getBoundingClientRect()
    const handle = el.querySelector('.handle-se') as HTMLElement

    handle.dispatchEvent(
        pointer('pointerdown', frameRect.right, frameRect.bottom)
    )
    window.dispatchEvent(pointer('pointermove', frameRect.left, frameRect.top))
    window.dispatchEvent(pointer('pointerup', frameRect.left, frameRect.top))

    const rectEl = el.querySelector('.crop-rect') as HTMLElement
    t.equal(parseFloat(rectEl.style.width), 32,
        'width should not shrink below 32px')
    t.equal(parseFloat(rectEl.style.height), 32,
        'height should not shrink below 32px')
})

test('dragging inside the rectangle moves it, clamped to image bounds', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="move-test" style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.move-test') as ImageCrop
    const file = await makeImageFile(200, 100)
    el.setFile(file)
    await waitForImageLoad(el)

    const frame = el.querySelector('.image-crop-frame') as HTMLElement
    const frameRect = frame.getBoundingClientRect()

    // shrink the crop first via the se handle, so there's room to move
    const seHandle = el.querySelector('.handle-se') as HTMLElement
    seHandle.dispatchEvent(
        pointer('pointerdown', frameRect.right, frameRect.bottom)
    )
    window.dispatchEvent(
        pointer('pointermove', frameRect.right - 50, frameRect.bottom - 30)
    )
    window.dispatchEvent(
        pointer('pointerup', frameRect.right - 50, frameRect.bottom - 30)
    )

    const rectEl = el.querySelector('.crop-rect') as HTMLElement
    t.equal(parseFloat(rectEl.style.width), 150, 'sanity check width after shrink')
    t.equal(parseFloat(rectEl.style.height), 70, 'sanity check height after shrink')

    // now drag the body of the rect far past the bottom-right bound
    rectEl.dispatchEvent(pointer('pointerdown', frameRect.left, frameRect.top))
    window.dispatchEvent(
        pointer('pointermove', frameRect.left + 1000, frameRect.top + 1000)
    )
    window.dispatchEvent(
        pointer('pointerup', frameRect.left + 1000, frameRect.top + 1000)
    )

    t.equal(parseFloat(rectEl.style.left), 50,
        'should clamp so the right edge stays inside the image')
    t.equal(parseFloat(rectEl.style.top), 30,
        'should clamp so the bottom edge stays inside the image')
})

test('crop state changes emit image-crop:change with natural pixel ' +
    'coordinates', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="change-test" style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.change-test') as ImageCrop
    const file = await makeImageFile(400, 200)
    el.setFile(file)
    await waitForImageLoad(el)

    const frame = el.querySelector('.image-crop-frame') as HTMLElement
    const frameRect = frame.getBoundingClientRect()
    const handle = el.querySelector('.handle-nw') as HTMLElement

    let detail:{ x:number, y:number, width:number, height:number }|null = null
    el.addEventListener('image-crop:change', (e:Event) => {
        detail = (e as CustomEvent).detail
    })

    handle.dispatchEvent(pointer('pointerdown', frameRect.left, frameRect.top))
    window.dispatchEvent(
        pointer('pointermove', frameRect.left + 10, frameRect.top + 5)
    )
    window.dispatchEvent(
        pointer('pointerup', frameRect.left + 10, frameRect.top + 5)
    )

    t.ok(detail, 'should have emitted image-crop:change')
    t.equal(detail!.x, 20, 'x should be scaled to natural pixels')
    t.equal(detail!.y, 10, 'y should be scaled to natural pixels')
    t.equal(detail!.width, 380, 'width should be scaled to natural pixels')
    t.equal(detail!.height, 190, 'height should be scaled to natural pixels')
})

function key (
    key:string,
    shiftKey = false
):KeyboardEvent {
    return new KeyboardEvent('keydown', {
        key,
        shiftKey,
        bubbles: true,
        cancelable: true
    })
}

test('the crop rectangle is focusable with an accessible name', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="a11y-test" style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.a11y-test') as ImageCrop
    const file = await makeImageFile(200, 100)
    el.setFile(file)
    await waitForImageLoad(el)

    const rectEl = el.querySelector('.crop-rect') as HTMLElement
    t.equal(rectEl.tabIndex, 0, 'crop rect should be in the tab order')
    t.ok(rectEl.getAttribute('role'), 'crop rect should have an ARIA role')
    t.ok(rectEl.getAttribute('aria-label'), 'crop rect should have an accessible label')
})

test('arrow keys move the crop rectangle', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="key-move-test" style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.key-move-test') as ImageCrop
    const file = await makeImageFile(200, 100)
    el.setFile(file)
    await waitForImageLoad(el)

    // shrink first so there's room to move
    const frame = el.querySelector('.image-crop-frame') as HTMLElement
    const frameRect = frame.getBoundingClientRect()
    const seHandle = el.querySelector('.handle-se') as HTMLElement
    seHandle.dispatchEvent(
        pointer('pointerdown', frameRect.right, frameRect.bottom)
    )
    window.dispatchEvent(
        pointer('pointermove', frameRect.right - 50, frameRect.bottom - 30)
    )
    window.dispatchEvent(
        pointer('pointerup', frameRect.right - 50, frameRect.bottom - 30)
    )

    const rectEl = el.querySelector('.crop-rect') as HTMLElement
    const leftBefore = parseFloat(rectEl.style.left)
    const topBefore = parseFloat(rectEl.style.top)

    rectEl.dispatchEvent(key('ArrowRight'))
    t.ok(parseFloat(rectEl.style.left) > leftBefore,
        'ArrowRight should move the crop rect right')

    rectEl.dispatchEvent(key('ArrowDown'))
    t.ok(parseFloat(rectEl.style.top) > topBefore,
        'ArrowDown should move the crop rect down')
})

test('shift+arrow keys resize the crop rectangle', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="key-resize-test" style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.key-resize-test') as ImageCrop
    const file = await makeImageFile(200, 100)
    el.setFile(file)
    await waitForImageLoad(el)

    const rectEl = el.querySelector('.crop-rect') as HTMLElement
    const widthBefore = parseFloat(rectEl.style.width)
    const heightBefore = parseFloat(rectEl.style.height)

    rectEl.dispatchEvent(key('ArrowLeft', true))
    t.ok(parseFloat(rectEl.style.width) < widthBefore,
        'shift+ArrowLeft should shrink the crop rect width')

    rectEl.dispatchEvent(key('ArrowUp', true))
    t.ok(parseFloat(rectEl.style.height) < heightBefore,
        'shift+ArrowUp should shrink the crop rect height')
})

function loadBlobDimensions (blob:Blob):Promise<{ width:number, height:number }> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(blob)
        img.onload = () => {
            URL.revokeObjectURL(url)
            resolve({ width: img.naturalWidth, height: img.naturalHeight })
        }
        img.onerror = reject
        img.src = url
    })
}

test('the crop getter returns the current rect in natural pixels', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="crop-getter-test" style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.crop-getter-test') as ImageCrop
    const file = await makeImageFile(400, 200)
    el.setFile(file)
    await waitForImageLoad(el)

    t.deepEqual(el.crop, { x: 0, y: 0, width: 400, height: 200 },
        'crop getter should cover the full natural image initially')
})

test('getBlob returns a Blob of the cropped region at natural resolution',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
            <image-crop class="getblob-test" style="display:block;width:200px;"></image-crop>
        `)
        const el = await waitFor('image-crop.getblob-test') as ImageCrop
        const file = await makeImageFile(400, 200)
        el.setFile(file)
        await waitForImageLoad(el)

        const frame = el.querySelector('.image-crop-frame') as HTMLElement
        const frameRect = frame.getBoundingClientRect()
        const handle = el.querySelector('.handle-nw') as HTMLElement

        handle.dispatchEvent(
            pointer('pointerdown', frameRect.left, frameRect.top)
        )
        window.dispatchEvent(
            pointer('pointermove', frameRect.left + 50, frameRect.top + 25)
        )
        window.dispatchEvent(
            pointer('pointerup', frameRect.left + 50, frameRect.top + 25)
        )

        t.deepEqual(el.crop, { x: 100, y: 50, width: 300, height: 150 },
            'sanity check crop rect after resize')

        const blob = await el.getBlob()
        t.ok(blob instanceof Blob, 'should resolve a Blob')
        t.equal(blob.type, 'image/png',
            'should default to the source file\'s own type')

        const dims = await loadBlobDimensions(blob)
        t.equal(dims.width, 300, 'blob width should match the crop width')
        t.equal(dims.height, 150, 'blob height should match the crop height')
    })

test('getBlob accepts a type option', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="getblob-type-test" style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.getblob-type-test') as ImageCrop
    const file = await makeImageFile(100, 100)
    el.setFile(file)
    await waitForImageLoad(el)

    const blob = await el.getBlob({ type: 'image/png' })
    t.equal(blob.type, 'image/png', 'should use the requested mime type')
})

test('keyboard interactions emit image-crop:change in natural pixels', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="key-change-test" style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.key-change-test') as ImageCrop
    const file = await makeImageFile(400, 200)
    el.setFile(file)
    await waitForImageLoad(el)

    let detail:{ x:number, y:number, width:number, height:number }|null = null
    el.addEventListener('image-crop:change', (e:Event) => {
        detail = (e as CustomEvent).detail
    })

    const rectEl = el.querySelector('.crop-rect') as HTMLElement
    rectEl.dispatchEvent(key('ArrowDown', true))

    t.ok(detail, 'should have emitted image-crop:change from a keydown')
})

test('constrains the displayed height by the element\'s max-height, ' +
    'preserving aspect ratio', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="max-height-test"
            style="display:block;width:400px;max-height:100px;"></image-crop>
    `)
    const el = await waitFor('image-crop.max-height-test') as ImageCrop
    // 1:2, so fitting 400px wide would be 800px tall -- far over the cap
    el.setFile(await makeImageFile(400, 800))
    await waitForImageLoad(el)

    const frame = el.querySelector('.image-crop-frame') as HTMLElement
    const width = parseFloat(frame.style.width)
    const height = parseFloat(frame.style.height)

    t.equal(height, 100, 'should cap the frame height at max-height')
    t.equal(width, 50,
        'should narrow the frame to keep the 1:2 aspect ratio at the ' +
        'capped height')
})

test('a locked crop keeps the frame and zoom slider within max-height',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
            <image-crop class="max-height-zoom-test" crop="1/1"
                style="display:block;width:400px;max-height:200px;">
            </image-crop>
        `)
        const el = await waitFor(
            'image-crop.max-height-zoom-test'
        ) as ImageCrop
        el.setFile(await makeImageFile(400, 800))
        await waitForImageLoad(el)

        const zoom = el.querySelector('.image-crop-zoom') as HTMLElement
        t.ok(!zoom.hidden, 'should show the zoom slider under a lock')
        t.ok(el.scrollHeight <= el.clientHeight,
            'the frame and zoom slider should not overflow the element')
    })

/**
 * Regression test. `#fitted` used to take its height budget from
 * `clientHeight`, which is the height of the frame it had itself just
 * sized. That fed each layout back into the next one, so the displayed
 * image could only ever shrink -- widening the container again left it
 * stuck at whatever size it first landed on.
 */
test('re-lays out to fill the container again after it grows back',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="regrow-test"
            style="display:block;width:200px;"></image-crop>
    `)
        const el = await waitFor('image-crop.regrow-test') as ImageCrop
        el.setFile(await makeImageFile(400, 200))
        await waitForImageLoad(el)

        const frame = el.querySelector('.image-crop-frame') as HTMLElement
        const startWidth = parseFloat(frame.style.width)
        const startHeight = parseFloat(frame.style.height)
        t.equal(startWidth, 200,
            'sanity check: should start out filling the container')

        el.style.width = '100px'
        window.dispatchEvent(new Event('resize'))
        t.equal(parseFloat(frame.style.width), 100,
            'should shrink the frame when the container narrows')

        el.style.width = '200px'
        window.dispatchEvent(new Event('resize'))

        t.equal(parseFloat(frame.style.width), startWidth,
            'should widen the frame back when the container widens')
        t.equal(parseFloat(frame.style.height), startHeight,
            'should restore the frame height along with the width')
    })

test('crop="3/4" locks the initial rect to that ratio, centered', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="ratio-literal-test" crop="3/4"
            style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.ratio-literal-test') as ImageCrop
    const file = await makeImageFile(400, 200)
    el.setFile(file)
    await waitForImageLoad(el)

    t.deepEqual(el.crop, { x: 125, y: 0, width: 150, height: 200 },
        'should be the largest 3:4 rect inside a 400x200 image, centered')

    const frame = el.querySelector('.image-crop-frame') as HTMLElement
    t.ok(frame.classList.contains('locked'),
        'the frame should be marked locked')
})

test('crop="constrain" locks to the source image\'s own ratio, and ' +
    'the starting rect covers the whole image', async t => {
    document.body.insertAdjacentHTML('beforeend', `
            <image-crop class="constrain-test" crop="constrain"
                style="display:block;width:200px;"></image-crop>
        `)
    const el = await waitFor('image-crop.constrain-test') as ImageCrop
    const file = await makeImageFile(200, 100)
    el.setFile(file)
    await waitForImageLoad(el)

    t.deepEqual(el.crop, { x: 0, y: 0, width: 200, height: 100 },
        'a lock to the image\'s own ratio still covers the whole image')

    const frame = el.querySelector('.image-crop-frame') as HTMLElement
    t.ok(frame.classList.contains('locked'),
        'the frame should be marked locked')
})

test('crop="circle" locks to 1:1 and marks the frame for circular chrome',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
            <image-crop class="circle-test" crop="circle"
                style="display:block;width:200px;"></image-crop>
        `)
        const el = await waitFor('image-crop.circle-test') as ImageCrop
        const file = await makeImageFile(400, 200)
        el.setFile(file)
        await waitForImageLoad(el)

        t.deepEqual(el.crop, { x: 100, y: 0, width: 200, height: 200 },
            'should be the largest square inside a 400x200 image, centered')

        const frame = el.querySelector('.image-crop-frame') as HTMLElement
        t.ok(frame.classList.contains('locked'), 'should be locked')
        t.ok(frame.classList.contains('circle'), 'should be marked circle')
    })

test('a circle-locked crop yields a square Blob, not a masked one', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="circle-blob-test" crop="circle"
            style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.circle-blob-test') as ImageCrop
    const file = await makeImageFile(400, 200)
    el.setFile(file)
    await waitForImageLoad(el)

    const blob = await el.getBlob()
    const dims = await loadBlobDimensions(blob)
    t.equal(dims.width, dims.height,
        'the blob should be square -- circle is UI chrome, not a mask')
})

test('an invalid crop value falls back to free-form cropping, without ' +
    'throwing', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="invalid-crop-test" crop="sideways"
            style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.invalid-crop-test') as ImageCrop
    const file = await makeImageFile(200, 100)
    el.setFile(file)
    await waitForImageLoad(el)

    t.deepEqual(el.crop, { x: 0, y: 0, width: 200, height: 100 },
        'should behave exactly like free-form: full image')

    const frame = el.querySelector('.image-crop-frame') as HTMLElement
    t.equal(frame.classList.contains('locked'), false,
        'the frame should not be marked locked')
})

async function lockedWide (cls:string):Promise<ImageCrop> {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="${cls}" crop="1/1"
            style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor(`image-crop.${cls}`) as ImageCrop
    el.setFile(await makeImageFile(200, 100))
    await waitForImageLoad(el)
    return el
}

test('a corner handle resizes a locked window, and the image stays put',
    async t => {
        const el = await lockedWide('locked-handle-test')
        const changes:CropRect[] = []
        el.addEventListener('image-crop:change', ev => {
            changes.push(ev.detail)
        })
        const windowBefore = box(el, '.crop-rect')
        const imgBefore = box(el, 'img')

        drag(el.querySelector('.handle-nw') as HTMLElement, 20, 20)

        const win = box(el, '.crop-rect')
        t.ok(near(win.width, windowBefore.width - 20, 0.5),
            'the window should shrink with the pointer')
        t.ok(near(win.width, win.height, 0.5), 'and keep its 1:1 ratio')
        t.ok(near(win.right, windowBefore.right, 0.5) &&
            near(win.bottom, windowBefore.bottom, 0.5),
        'the opposite corner should stay put')
        t.ok(nearRect(box(el, 'img'), imgBefore, 0.5),
            'the image should not move or resize')

        t.ok(nearRect(el.crop, { x: 70, y: 20, width: 80, height: 80 }),
            'the crop should be what the window now covers')
        t.ok(changes.length > 0 &&
            nearRect(changes[changes.length - 1], el.crop),
        'should emit change with the new crop')
        t.ok(near(Number(zoomInput(el).value), 200 / 80),
            'the slider should follow the new crop size')
    })

test('an edge handle does not resize a locked window', async t => {
    const el = await lockedWide('locked-edge-handle-test')
    const windowBefore = box(el, '.crop-rect')

    for (const dir of ['n', 'e', 's', 'w']) {
        drag(el.querySelector(`.handle-${dir}`) as HTMLElement, -20, 10)
    }

    const win = box(el, '.crop-rect')
    t.ok(near(win.width, windowBefore.width) &&
        near(win.height, windowBefore.height),
    'the window should not resize')
    t.equal(el.crop.width, 100, 'the crop width should not change')
    t.equal(el.crop.height, 100, 'the crop height should not change')
})

test('a resized window keeps its size through a pan, a zoom and a ' +
    'container resize', async t => {
    const el = await lockedWide('locked-window-keeps-test')
    drag(el.querySelector('.handle-se') as HTMLElement, -40, 0)
    const win = box(el, '.crop-rect')
    t.ok(near(win.width, 60, 0.5), 'sanity check: the window shrank')

    drag(el.querySelector('img') as HTMLElement, 10, 10)
    setZoom(el, Number(zoomInput(el).value) * 1.5)
    t.ok(nearRect(box(el, '.crop-rect'), win, 0.5),
        'the window should keep its size and place')

    const crop = el.crop
    el.style.width = '100px'
    window.dispatchEvent(new Event('resize'))
    const half = box(el, '.crop-rect')
    t.ok(near(half.width, win.width / 2, 0.5) &&
        near(half.height, win.height / 2, 0.5),
    'a container half as wide should halve the window')
    t.ok(nearRect(el.crop, crop), 'and keep the crop')
})

test('a corner handle cannot push the zoom past the slider\'s range',
    async t => {
        const el = await lockedWide('locked-handle-zoom-range-test')
        const input = zoomInput(el)

        setZoom(el, input.max)
        const atMax = box(el, '.crop-rect')
        drag(el.querySelector('.handle-nw') as HTMLElement, 1000, 1000)
        t.ok(Number(input.value) <= Number(input.max) + 1e-6,
            'shrinking the window should not zoom in past the max')
        t.ok(nearRect(box(el, '.crop-rect'), atMax, 0.5),
            'so at max zoom the window should not shrink')

        const grow = await lockedWide('locked-handle-zoom-out-test')
        drag(grow.querySelector('.handle-se') as HTMLElement, -50, 0)
        setZoom(grow, 1)
        drag(grow.querySelector('.handle-se') as HTMLElement, 1000, 1000)
        t.ok(grow.crop.width <= 200 + 1e-6,
            'growing the window should not zoom out past the stage')
    })

test('a corner handle cannot open up padding', async t => {
    const el = await lockedWide('locked-handle-padding-test')
    setZoom(el, 1)
    drag(el.querySelector('.handle-se') as HTMLElement, -40, 0)

    const { x, y, width, height } = el.crop
    t.ok(width < 200 && x >= 0 && x + width <= 200,
        'narrower than the image, the crop should stay inside it')
    t.ok(height > 100 && y <= 0 && y + height >= 100,
        'taller than the image, the image should stay inside the crop')
})

test('shift+arrow keys zoom a locked crop: up and right in, down and ' +
    'left out', async t => {
    const el = await lockedWide('locked-key-zoom-test')
    const rectEl = el.querySelector('.crop-rect') as HTMLElement

    for (const name of ['ArrowUp', 'ArrowRight']) {
        const before = el.crop
        rectEl.dispatchEvent(key(name, true))
        t.ok(el.crop.width < before.width,
            `shift+${name} should zoom in to a smaller crop`)
        t.ok(near(el.crop.width, el.crop.height),
            'the 1:1 ratio should be preserved')
    }

    for (const name of ['ArrowDown', 'ArrowLeft']) {
        const before = el.crop
        rectEl.dispatchEvent(key(name, true))
        t.ok(el.crop.width > before.width,
            `shift+${name} should zoom out to a larger crop`)
        t.ok(near(el.crop.width, el.crop.height),
            'the 1:1 ratio should be preserved')
    }
})

test('arrow keys move the image behind a locked crop', async t => {
    const el = await lockedWide('locked-key-pan-test')
    const rectEl = el.querySelector('.crop-rect') as HTMLElement
    const img = el.querySelector('img') as HTMLImageElement
    const windowBefore = rectEl.getBoundingClientRect()

    const before = el.crop
    const imgBefore = img.getBoundingClientRect()
    rectEl.dispatchEvent(key('ArrowRight'))
    t.ok(img.getBoundingClientRect().left > imgBefore.left,
        'ArrowRight should move the image right')
    t.ok(el.crop.x < before.x,
        'so the crop should move toward the image\'s left edge')
    t.equal(el.crop.width, before.width, 'the size should not change')

    const middle = el.crop
    const imgMiddle = img.getBoundingClientRect()
    rectEl.dispatchEvent(key('ArrowLeft'))
    rectEl.dispatchEvent(key('ArrowLeft'))
    t.ok(img.getBoundingClientRect().left < imgMiddle.left,
        'ArrowLeft should move the image left')
    t.ok(el.crop.x > middle.x,
        'so the crop should move toward the image\'s right edge')

    t.ok(nearRect(rectEl.getBoundingClientRect(), windowBefore),
        'the crop window should stay put')
})

test('changing the crop attribute after an image has loaded re-fits ' +
    'the rect to the new constraint', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="refit-test"
            style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.refit-test') as ImageCrop
    const file = await makeImageFile(400, 200)
    el.setFile(file)
    await waitForImageLoad(el)

    t.deepEqual(el.crop, { x: 0, y: 0, width: 400, height: 200 },
        'sanity check: free-form starts out covering the whole image')

    const frameBefore = el.querySelector('.image-crop-frame') as HTMLElement
    t.equal(frameBefore.classList.contains('locked'), false,
        'should not be locked yet')

    el.setAttribute('crop', '1/1')

    t.deepEqual(el.crop, { x: 100, y: 0, width: 200, height: 200 },
        'should immediately re-fit to the largest square, centered')

    const frameAfter = el.querySelector('.image-crop-frame') as HTMLElement
    t.ok(frameAfter.classList.contains('locked'),
        'should now be marked locked')
})

test('emits image-crop:load with the natural size when an image ' +
    'finishes loading', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="load-event-test"
            style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.load-event-test') as ImageCrop

    const loaded = new Promise<{
        naturalWidth:number, naturalHeight:number
    }>(resolve => {
        el.addEventListener('image-crop:load', ((ev:CustomEvent) => {
            resolve(ev.detail)
        }) as EventListener, { once: true })
    })

    el.setFile(await makeImageFile(400, 200))
    const detail = await loaded

    t.equal(detail.naturalWidth, 400,
        'should report the natural width')
    t.equal(detail.naturalHeight, 200,
        'should report the natural height')
})

test('emits image-crop:change with the initial rect when an image ' +
    'loads', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="load-change-test"
            style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.load-change-test') as ImageCrop

    const changed = new Promise<CropRect>(resolve => {
        el.addEventListener('image-crop:change', ((ev:CustomEvent) => {
            resolve(ev.detail)
        }) as EventListener, { once: true })
    })

    el.setFile(await makeImageFile(400, 200))
    const detail = await changed

    t.deepEqual(detail, { x: 0, y: 0, width: 400, height: 200 },
        'the first change should carry the full-frame initial rect')
})

test('announces readiness before the rect, and announces a ' +
    'constrained initial rect too', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="load-order-test" crop="1/1"
            style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.load-order-test') as ImageCrop

    const order:string[] = []
    el.addEventListener('image-crop:load', () => {
        order.push('load')
    }, { once: true })

    const changed = new Promise<CropRect>(resolve => {
        el.addEventListener('image-crop:change', ((ev:CustomEvent) => {
            order.push('change')
            resolve(ev.detail)
        }) as EventListener, { once: true })
    })

    el.setFile(await makeImageFile(400, 200))
    const detail = await changed

    t.deepEqual(order, ['load', 'change'],
        'load should come before change')
    t.deepEqual(detail, el.crop,
        'the change detail should match the crop getter')
    t.equal(detail.width, detail.height,
        'a 1/1 constraint should announce a square initial rect')
})

test('emits load and change again for a second image', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="load-twice-test"
            style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.load-twice-test') as ImageCrop

    const first = new Promise<CropRect>(resolve => {
        el.addEventListener('image-crop:change', ((ev:CustomEvent) => {
            resolve(ev.detail)
        }) as EventListener, { once: true })
    })
    el.setFile(await makeImageFile(400, 200))
    await first

    const second = new Promise<CropRect>(resolve => {
        el.addEventListener('image-crop:change', ((ev:CustomEvent) => {
            resolve(ev.detail)
        }) as EventListener, { once: true })
    })
    el.setFile(await makeImageFile(100, 50))
    const detail = await second

    t.deepEqual(detail, { x: 0, y: 0, width: 100, height: 50 },
        'the second image should announce its own initial rect, not ' +
        'the first image\'s')
})

test('a src containing a quote cannot inject attributes into the ' +
    'rendered markup', async t => {
    const el = document.createElement('image-crop') as ImageCrop
    el.className = 'src-escape-test'
    el.setAttribute('src', '" data-injected="yes')
    document.body.appendChild(el)

    const imgs = el.querySelectorAll('img')
    t.equal(imgs.length, 1, 'should render exactly one img')
    t.equal(imgs[0].getAttribute('data-injected'), null,
        'should not let the src value introduce an attribute')
    t.equal(el.querySelectorAll('.crop-rect').length, 1,
        'the rest of the template should still be intact')
})

test('AC6.1 set after connect: crossorigin attribute set on inner img',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
            <image-crop class="crossorigin-set-test"
                crossorigin="anonymous"
                style="display:block;width:200px;"></image-crop>
        `)
        const el = await waitFor('image-crop.crossorigin-set-test') as ImageCrop
        el.src = '/fixtures/photo.png'
        await waitForImageLoad(el)

        const img = el.querySelector('img') as HTMLImageElement
        t.equal(img.crossOrigin, 'anonymous',
            'the inner img should have crossOrigin set to anonymous')
    })

test('AC6.1 after render: crossorigin reflected before appending', async t => {
    const el = document.createElement('image-crop') as ImageCrop
    el.className = 'crossorigin-render-test'
    el.setAttribute('crossorigin', 'use-credentials')
    el.style.display = 'block'
    el.style.width = '200px'
    document.body.appendChild(el)

    await waitFor('image-crop.crossorigin-render-test')
    const file = await makeImageFile(100, 100)
    el.setFile(file)
    await waitForImageLoad(el)

    const img = el.querySelector('img') as HTMLImageElement
    t.equal(img.crossOrigin, 'use-credentials',
        'the inner img should have crossOrigin set after render')

    el.crossorigin = null
    t.equal(img.crossOrigin, null,
        'removing the attribute should clear the crossorigin attribute')
})

test('AC6.2: switching from file to URL resets crop and rejects getBlob ' +
    'until load', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="reset-test"
            style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.reset-test') as ImageCrop

    // 1. setFile and wait for load
    el.setFile(await makeImageFile(200, 100))
    await waitForImageLoad(el)
    t.ok(el.crop.width > 0, 'after setFile and load, crop should have width')

    // 2. Set src to a URL
    el.src = '/fixtures/photo.png'
    t.deepEqual(el.crop, { x: 0, y: 0, width: 0, height: 0 },
        'setting src to a URL should reset crop to empty')

    // 3. getBlob should reject
    let rejected = false
    try {
        await el.getBlob()
    } catch (_err) {
        rejected = true
    }
    t.ok(rejected, 'getBlob should reject while loading a URL')

    // 4. Wait for load and check that crop is populated again
    await waitForImageLoad(el)
    t.ok(el.crop.width > 0,
        'after URL load, crop should have width again')
    const blob = await el.getBlob()
    t.ok(blob instanceof Blob,
        'getBlob should resolve after URL load')
})

const CARD = 1200 / 630

async function lockedSquare (
    cls:string,
    attrs = '',
    file?:File
):Promise<ImageCrop> {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="${cls}" crop="1200/630" ${attrs}
            style="display:block;width:380px;"></image-crop>
    `)
    const el = await waitFor(`image-crop.${cls}`) as ImageCrop
    el.setFile(file ?? await makeImageFile(100, 100))
    await waitForImageLoad(el)
    return el
}

function near (a:number, b:number, epsilon = 0.01):boolean {
    return Math.abs(a - b) <= epsilon
}

test('a locked ratio still starts at the cover rect', async t => {
    const el = await lockedSquare('stage-cover-test')
    t.deepEqual(el.crop, fitRatioRect(CARD, 100, 100),
        'should start at the largest card-shaped rect inside the image')
})

function box (el:ImageCrop, selector:string):DOMRect {
    return (el.querySelector(selector) as HTMLElement).getBoundingClientRect()
}

function drag (target:Element, dx:number, dy:number):void {
    const { left, top } = target.getBoundingClientRect()
    target.dispatchEvent(pointer('pointerdown', left + 5, top + 5))
    window.dispatchEvent(pointer('pointermove', left + 5 + dx, top + 5 + dy))
    window.dispatchEvent(pointer('pointerup', left + 5 + dx, top + 5 + dy))
}

function inside (inner:DOMRect, outer:DOMRect, epsilon = 0.5):boolean {
    return inner.left >= outer.left - epsilon &&
        inner.top >= outer.top - epsilon &&
        inner.right <= outer.right + epsilon &&
        inner.bottom <= outer.bottom + epsilon
}

test('the crop window stays put while the image zooms and pans',
    async t => {
        const el = await lockedSquare('window-fixed-test')
        const windowBefore = box(el, '.crop-rect')
        const imgBefore = box(el, 'img')

        setZoom(el, zoomInput(el).max)
        drag(el.querySelector('img') as HTMLElement, 15, -10)
        t.ok(!nearRect(box(el, 'img'), imgBefore),
            'sanity check: the image should have moved')
        t.ok(nearRect(box(el, '.crop-rect'), windowBefore),
            'the window should not move or resize')

        setZoom(el, 1)
        t.ok(nearRect(box(el, '.crop-rect'), windowBefore),
            'the window should not move or resize at zoom 1 either')
    })

test('zooming changes the image\'s size on screen', async t => {
    const el = await lockedSquare('zoom-image-size-test')
    const before = box(el, 'img')
    const zoom = Number(zoomInput(el).value)

    setZoom(el, zoom * 2)
    const zoomedIn = box(el, 'img')
    t.ok(near(zoomedIn.width / before.width, 2) &&
        near(zoomedIn.height / before.height, 2),
    'twice the zoom should draw the image twice as large')

    setZoom(el, 1)
    t.ok(box(el, 'img').width < before.width,
        'zooming out should draw the image smaller')
})

test('at zoom 1 the whole image fits inside the window', async t => {
    const el = await lockedSquare('zoom-one-fit-test')
    setZoom(el, 1)
    const win = box(el, '.crop-rect')
    const img = box(el, 'img')

    t.ok(inside(img, win), 'the image should be inside the window')
    t.ok(near(img.height, win.height, 0.5),
        'and should fill it on its own long axis')
})

test('dragging the image around the window pans the image', async t => {
    const el = await lockedSquare('pan-drag-test')
    const changes:CropRect[] = []
    el.addEventListener('image-crop:change', ev => {
        changes.push(ev.detail)
    })
    const before = el.crop
    const imgBefore = box(el, 'img')
    const windowBefore = box(el, '.crop-rect')

    drag(el.querySelector('img') as HTMLElement, 0, 10)

    t.ok(near(box(el, 'img').top, imgBefore.top + 10, 0.5),
        'the image should move with the pointer')
    t.ok(nearRect(box(el, '.crop-rect'), windowBefore),
        'the window should not move')
    t.ok(el.crop.y < before.y, 'so the crop should move up the image')
    t.equal(el.crop.height, before.height, 'the size should not change')
    t.ok(changes.length > 0 &&
        nearRect(changes[changes.length - 1], el.crop),
    'the pan should emit change with the new rect')
})

test('dragging the window moves it over the still image', async t => {
    const el = await lockedWide('window-move-test')
    const changes:CropRect[] = []
    el.addEventListener('image-crop:change', ev => {
        changes.push(ev.detail)
    })
    const windowBefore = box(el, '.crop-rect')
    const imgBefore = box(el, 'img')

    drag(el.querySelector('.crop-rect') as HTMLElement, -20, 0)

    const win = box(el, '.crop-rect')
    t.ok(near(win.left, windowBefore.left - 20, 0.5),
        'the window should move with the pointer')
    t.ok(near(win.width, windowBefore.width, 0.5),
        'the window should not resize')
    t.ok(nearRect(box(el, 'img'), imgBefore, 0.5),
        'the image should not move or resize')
    t.ok(nearRect(el.crop, { x: 30, y: 0, width: 100, height: 100 }),
        'the crop should be what the window now covers')
    t.ok(changes.length > 0 &&
        nearRect(changes[changes.length - 1], el.crop),
    'the move should emit change with the new rect')
})

test('a window shrunk from a top corner can be dragged back up',
    async t => {
        const el = await lockedWide('window-move-up-test')
        drag(el.querySelector('.handle-ne') as HTMLElement, -40, 40)
        const parked = box(el, '.crop-rect')
        const imgBefore = box(el, 'img')
        t.ok(near(parked.bottom, imgBefore.bottom, 0.5),
            'sanity check: the window sits on the bottom edge')

        drag(el.querySelector('.crop-rect') as HTMLElement, 0, -20)

        t.ok(near(box(el, '.crop-rect').top, parked.top - 20, 0.5),
            'the window should move up with the pointer')
        t.ok(nearRect(box(el, 'img'), imgBefore, 0.5),
            'the image should not move')
        t.ok(near(el.crop.y, 20), 'the crop should move up the image')
    })

test('a dragged window stays on the image and cannot open up padding',
    async t => {
        const el = await lockedWide('window-move-clamp-test')
        drag(el.querySelector('.crop-rect') as HTMLElement, 1000, 1000)

        t.ok(inside(box(el, '.crop-rect'), box(el, 'img')),
            'the window should stay on the image')
        t.ok(inside(box(el, '.crop-rect'),
            box(el, '.image-crop-frame')),
        'and inside the frame')
        t.ok(nearRect(el.crop, { x: 100, y: 0, width: 100, height: 100 }),
            'the crop should stop at the image\'s edge')

        setZoom(el, 1)
        drag(el.querySelector('.crop-rect') as HTMLElement, 0, 1000)
        const { y, height } = el.crop
        t.ok(y <= 1e-6 && y + height >= 100 - 1e-6,
            'taller than the image, the image should stay inside the crop')
    })

test('panning cannot open up padding at the cover zoom', async t => {
    const el = await lockedSquare('pan-clamp-test', 'fill="#ff0000"',
        await makeTransparentFile(100, 100))
    const img = el.querySelector('img') as HTMLImageElement
    const rectEl = el.querySelector('.crop-rect') as HTMLElement

    for (const [dx, dy] of [[1000, 1000], [-2000, -2000]]) {
        drag(img, dx, dy)
        for (let i = 0; i < 40; i++) {
            rectEl.dispatchEvent(key(dx > 0 ? 'ArrowRight' : 'ArrowLeft'))
            rectEl.dispatchEvent(key(dy > 0 ? 'ArrowDown' : 'ArrowUp'))
        }

        const { x, y, width, height } = el.crop
        t.ok(x >= 0 && y >= 0 && x + width <= 100 + 1e-6 &&
            y + height <= 100 + 1e-6,
        'the crop should stay inside the image')
        t.ok(inside(box(el, '.crop-rect'), box(el, 'img')),
            'the image should still cover the window')

        const blob = await el.getBlob({ type: 'image/png' })
        const dims = await loadBlobDimensions(blob)
        t.equal((await pixelAt(blob, 0, 0))[3], 0,
            'the top left pixel should not be filled')
        t.equal((await pixelAt(blob, dims.width - 1, dims.height - 1))[3],
            0, 'the bottom right pixel should not be filled')
    }
})

test('shift+arrow zooms out to the stage and in to the slider\'s ' +
    'max, and no further', async t => {
    const el = await lockedSquare('key-zoom-range-test')
    const rectEl = el.querySelector('.crop-rect') as HTMLElement
    const stage = containRatioRect(CARD, 100, 100)

    for (let i = 0; i < 80; i++) rectEl.dispatchEvent(key('ArrowDown', true))
    t.equal(Number(zoomInput(el).value), 1, 'should stop at zoom 1')
    const dims = await loadBlobDimensions(await el.getBlob())
    t.equal(dims.width, Math.floor(stage.width),
        'the blob should be the stage width')
    t.equal(dims.height, stage.height, 'the blob should be the stage height')

    for (let i = 0; i < 80; i++) rectEl.dispatchEvent(key('ArrowUp', true))
    t.ok(near(Number(zoomInput(el).value), Number(zoomInput(el).max)),
        'should stop at the slider\'s max')
    t.ok(near(el.crop.width, fitRatioRect(CARD, 100, 100).width / 4),
        'the max should be 4x past the cover rect')
})

function zoomLabel (el:ImageCrop):HTMLLabelElement {
    return el.querySelector('.image-crop-zoom') as HTMLLabelElement
}

function zoomInput (el:ImageCrop):HTMLInputElement {
    return el.querySelector('.image-crop-zoom input') as HTMLInputElement
}

function setZoom (el:ImageCrop, value:number|string):void {
    const input = zoomInput(el)
    input.value = String(value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
}

function center (rect:CropRect):[number, number] {
    return [rect.x + rect.width / 2, rect.y + rect.height / 2]
}

function nearRect (a:CropRect, b:CropRect, epsilon = 0.01):boolean {
    return near(a.x, b.x, epsilon) && near(a.y, b.y, epsilon) &&
        near(a.width, b.width, epsilon) && near(a.height, b.height, epsilon)
}

test('a free-form cropper hides the zoom slider', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="zoom-free-test"
            style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.zoom-free-test') as ImageCrop
    el.setFile(await makeImageFile(100, 100))
    await waitForImageLoad(el)

    t.ok(zoomLabel(el), 'should render the slider')
    t.equal(zoomLabel(el).hidden, true, 'should hide it')
})

test('a locked cropper shows the zoom slider at the cover zoom',
    async t => {
        const el = await lockedSquare('zoom-cover-test')
        const input = zoomInput(el)
        const stage = containRatioRect(CARD, 100, 100)
        const cover = fitRatioRect(CARD, 100, 100)

        t.equal(zoomLabel(el).hidden, false, 'should show the slider')
        t.equal(input.type, 'range', 'should be a native range input')
        t.equal(input.min, '1', 'should start at the whole stage')
        t.ok(near(Number(input.value), stage.width / cover.width),
            'should sit at the cover rect')
    })

test('zoom 1 sets the rect to the stage', async t => {
    const el = await lockedSquare('zoom-one-test')
    const changes:CropRect[] = []
    el.addEventListener('image-crop:change', ev => {
        changes.push(ev.detail)
    })
    setZoom(el, 1)

    const stage = containRatioRect(CARD, 100, 100)
    t.ok(nearRect(el.crop, stage), 'should be the whole stage')
    t.equal(changes.length, 1, 'should emit one change')
    t.ok(changes[0] && nearRect(changes[0], stage),
        'the change should carry the new rect')
})

test('the zoom slider keeps the rect centered', async t => {
    const el = await lockedSquare('zoom-center-test')
    const [cx, cy] = center(el.crop)
    setZoom(el, zoomInput(el).max)
    const [nx, ny] = center(el.crop)

    t.ok(el.crop.width < fitRatioRect(CARD, 100, 100).width,
        'should zoom in')
    t.ok(near(cx, nx, 0.5) && near(cy, ny, 0.5),
        'should keep the center')
})

test('shift+arrow keys move the zoom slider', async t => {
    const el = await lockedSquare('zoom-key-slider-test')
    const rectEl = el.querySelector('.crop-rect') as HTMLElement
    const before = Number(zoomInput(el).value)

    rectEl.dispatchEvent(key('ArrowUp', true))
    t.ok(Number(zoomInput(el).value) > before,
        'zooming in should raise the slider')

    rectEl.dispatchEvent(key('ArrowDown', true))
    rectEl.dispatchEvent(key('ArrowDown', true))
    t.ok(Number(zoomInput(el).value) < before,
        'zooming out should lower the slider')
})

test('a resize keeps the zoomed rect and the slider value', async t => {
    const el = await lockedSquare('zoom-resize-test')
    setZoom(el, 1)
    const rect = el.crop
    const value = Number(zoomInput(el).value)

    el.style.width = '250px'
    window.dispatchEvent(new Event('resize'))

    t.ok(nearRect(el.crop, rect), 'should keep the natural rect')
    t.ok(near(Number(zoomInput(el).value), value),
        'should keep the slider value')
})

test('a second image resets the zoom to its own cover', async t => {
    const el = await lockedSquare('zoom-second-test')
    setZoom(el, 1)
    el.setFile(await makeImageFile(400, 100))
    await waitForImageLoad(el)

    const stage = containRatioRect(CARD, 400, 100)
    const cover = fitRatioRect(CARD, 400, 100)
    t.deepEqual(el.crop, cover, 'should start at the new cover rect')
    t.ok(near(Number(zoomInput(el).value), stage.width / cover.width),
        'the slider should sit at the new cover zoom')
})

test('switching to free-form after zooming out returns the rect to ' +
    'the image', async t => {
    const el = await lockedSquare('zoom-free-again-test')
    setZoom(el, 1)
    el.removeAttribute('crop')

    t.deepEqual(el.crop, { x: 0, y: 0, width: 100, height: 100 },
        'should cover exactly the image')
    t.equal(zoomLabel(el).hidden, true, 'should hide the slider')

    const rectEl = el.querySelector('.crop-rect') as HTMLElement
    for (let i = 0; i < 40; i++) rectEl.dispatchEvent(key('ArrowLeft'))
    t.ok(el.crop.x >= 0, 'the stage should be the image again')
})

test('a zoomed-out crop pads the blob with the fill color', async t => {
    const el = await lockedSquare('fill-color-test', 'fill="#ff0000"')
    setZoom(el, 1)
    const blob = await el.getBlob()

    const dims = await loadBlobDimensions(blob)
    t.equal(dims.width, 190, 'should be the stage width')
    t.equal(dims.height, 100, 'should be the stage height')
    t.deepEqual(await pixelAt(blob, 1, 50), [255, 0, 0, 255],
        'the padding should be the fill color')
    t.notDeepEqual(await pixelAt(blob, 95, 50), [255, 0, 0, 255],
        'the image should be drawn over the fill')
})

test('the padding defaults to white', async t => {
    const el = await lockedSquare('fill-default-test')
    setZoom(el, 1)
    const blob = await el.getBlob()
    t.deepEqual(await pixelAt(blob, 1, 50), [255, 255, 255, 255],
        'the padding should be white')
})

test('a crop inside the image paints no fill', async t => {
    const el = await lockedSquare('fill-none-test', 'fill="#ff0000"',
        await makeTransparentFile(100, 100))
    const blob = await el.getBlob({ type: 'image/png' })
    t.equal((await pixelAt(blob, 1, 1))[3], 0,
        'a transparent pixel should stay transparent')
})

test('a resize at max zoom keeps the slider in step with the rect',
    async t => {
        const el = await lockedSquare('zoom-resize-max-test')
        setZoom(el, zoomInput(el).max)
        el.style.width = '250px'
        window.dispatchEvent(new Event('resize'))

        const stage = containRatioRect(CARD, 100, 100)
        t.ok(near(Number(zoomInput(el).value),
            stage.width / el.crop.width),
        'the slider should still read the rect\'s zoom')
    })

test('a free-form crop nudged against an edge paints no fill',
    async t => {
        document.body.insertAdjacentHTML('beforeend', `
            <image-crop class="drift-free-test" fill="#ff0000"
                style="display:block;width:209px;"></image-crop>
        `)
        const el = await waitFor('image-crop.drift-free-test') as ImageCrop
        el.setFile(await makeTransparentFile(100, 100))
        await waitForImageLoad(el)
        const rectEl = el.querySelector('.crop-rect') as HTMLElement
        rectEl.dispatchEvent(key('ArrowLeft', true))
        rectEl.dispatchEvent(key('ArrowLeft', true))
        for (let i = 0; i < 3; i++) rectEl.dispatchEvent(key('ArrowRight'))

        const blob = await el.getBlob({ type: 'image/png' })
        t.equal((await pixelAt(blob, 1, 1))[3], 0,
            'a transparent pixel should stay transparent')
    })

test('a locked crop nudged inside the image paints no fill', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="drift-locked-test" crop="1200/630"
            fill="#ff0000" style="display:block;width:251px;"></image-crop>
    `)
    const el = await waitFor('image-crop.drift-locked-test') as ImageCrop
    el.setFile(await makeTransparentFile(100, 100))
    await waitForImageLoad(el)
    const rectEl = el.querySelector('.crop-rect') as HTMLElement
    rectEl.dispatchEvent(key('ArrowUp'))
    rectEl.dispatchEvent(key('ArrowDown'))

    const blob = await el.getBlob({ type: 'image/png' })
    t.equal((await pixelAt(blob, 1, 1))[3], 0,
        'a transparent pixel should stay transparent')
})
