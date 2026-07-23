import { test } from '@substrate-system/tapzero'
import { waitFor } from '@substrate-system/dom'
import '../src/crop.js'
import type { ImageCrop } from '../src/crop.js'

function makeImageFile (
    width:number,
    height:number,
    color = '#ff0000'
):Promise<File> {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    ctx.fillStyle = color
    ctx.fillRect(0, 0, width, height)

    return new Promise((resolve) => {
        canvas.toBlob(blob => {
            resolve(new File([blob as Blob], 'photo.png', { type: 'image/png' }))
        }, 'image/png')
    })
}

function waitForImageLoad (el:ImageCrop):Promise<void> {
    return new Promise(resolve => {
        const img = el.querySelector('img') as HTMLImageElement
        if (img.complete && img.naturalWidth) return resolve()
        img.addEventListener('load', () => resolve(), { once: true })
    })
}

test('example test', async t => {
    document.body.innerHTML += `
        <image-crop class="test"></image-crop>
    `
    const el = await waitFor('image-crop')
    t.ok(el, 'should find an element')
})

test('accepts an image via setFile and renders it at a size that ' +
    'fits the element, preserving aspect ratio', async t => {
    document.body.innerHTML += `
        <image-crop class="setfile-test" style="display:block;width:200px;"></image-crop>
    `
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
    document.body.innerHTML += `
        <image-crop class="src-test"></image-crop>
    `
    const el = await waitFor('image-crop.src-test') as ImageCrop
    const file = await makeImageFile(10, 10)
    el.src = URL.createObjectURL(file)

    const img = el.querySelector('img') as HTMLImageElement
    t.ok(img.getAttribute('src'), 'should set the img src from the src attribute')
})

test('renders a crop rectangle with 8 handles, covering the full ' +
    'image initially', async t => {
    document.body.innerHTML += `
        <image-crop class="rect-test" style="display:block;width:200px;"></image-crop>
    `
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

test('dims the area outside the crop rectangle', async t => {
    document.body.innerHTML += `
        <image-crop class="dim-test" style="display:block;width:200px;"></image-crop>
    `
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
    document.body.innerHTML += `
        <image-crop class="resize-test" style="display:block;width:200px;"></image-crop>
    `
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
    document.body.innerHTML += `
        <image-crop class="minsize-test" style="display:block;width:200px;"></image-crop>
    `
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
    document.body.innerHTML += `
        <image-crop class="move-test" style="display:block;width:200px;"></image-crop>
    `
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
    document.body.innerHTML += `
        <image-crop class="change-test" style="display:block;width:200px;"></image-crop>
    `
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
    document.body.innerHTML += `
        <image-crop class="a11y-test" style="display:block;width:200px;"></image-crop>
    `
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
    document.body.innerHTML += `
        <image-crop class="key-move-test" style="display:block;width:200px;"></image-crop>
    `
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
    document.body.innerHTML += `
        <image-crop class="key-resize-test" style="display:block;width:200px;"></image-crop>
    `
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

test('keyboard interactions emit image-crop:change in natural pixels', async t => {
    document.body.innerHTML += `
        <image-crop class="key-change-test" style="display:block;width:200px;"></image-crop>
    `
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
