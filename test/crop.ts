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
