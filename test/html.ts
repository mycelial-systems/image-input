import { test } from '@substrate-system/tapzero'
import { html } from '../src/html.js'

function parse (markup:string):HTMLElement {
    const host = document.createElement('div')
    host.innerHTML = markup
    return host
}

test('html() emits the box, picker and prompt', async t => {
    const host = parse(html())

    t.equal(host.querySelector('.wrapper'), null,
        'the .wrapper div should be gone')

    const box = host.querySelector('.box')
    t.ok(box, 'should emit a .box')

    const picker = box?.querySelector('.picker')
    t.ok(picker, 'should emit a .picker inside the box')

    const input = picker?.querySelector('input[type="file"]')
    t.ok(input, 'the file input should be inside the picker')

    t.ok(box?.querySelector('.prompt'), 'should emit a .prompt')
    t.ok(box?.querySelector('.preview'), 'should emit a .preview')
    t.ok(box?.querySelector('.overlay'), 'should emit an .overlay')
})

test('html() emits both dialogs by default, outside the box', async t => {
    const host = parse(html())

    const altDialog = host.querySelector('.alt-dialog')
    const cropDialog = host.querySelector('.crop-dialog')

    t.ok(altDialog, 'should emit the alt dialog')
    t.ok(cropDialog, 'should emit the crop dialog')
    t.ok(host.querySelector('.crop-slot'),
        'should emit the empty crop slot')

    const box = host.querySelector('.box')
    t.equal(box?.contains(altDialog as Node), false,
        'the alt dialog should be a sibling of the box, not a child')
    t.equal(box?.contains(cropDialog as Node), false,
        'the crop dialog should be a sibling of the box, not a child')
})

test('html({ dialogs: false }) emits the box alone', async t => {
    const host = parse(html({ dialogs: false }))

    t.ok(host.querySelector('.box'), 'should still emit the box')
    t.equal(host.querySelector('.alt-dialog'), null,
        'should emit no alt dialog')
    t.equal(host.querySelector('.crop-dialog'), null,
        'should emit no crop dialog')
})

test('html() emits no id attributes anywhere', async t => {
    const host = parse(html())

    t.equal(host.querySelectorAll('[id]').length, 0,
        'light-DOM markup must not carry ids')
    t.equal(host.querySelectorAll('[for]').length, 0,
        'and no for attributes either')
})

test('html() passes attributes through to the file input', async t => {
    const host = parse(html({
        accept: 'image/png',
        name: 'avatar',
        required: true
    }))
    const input = host.querySelector(
        'input[type="file"]'
    ) as HTMLInputElement

    t.equal(input.getAttribute('accept'), 'image/png',
        'should set accept')
    t.equal(input.getAttribute('name'), 'avatar', 'should set name')
    t.equal(input.hasAttribute('required'), true,
        'should set required')
})

test('html() omits name and required when not asked for', async t => {
    const host = parse(html())
    const input = host.querySelector(
        'input[type="file"]'
    ) as HTMLInputElement

    t.equal(input.hasAttribute('name'), false,
        'should emit no name attribute')
    t.equal(input.hasAttribute('required'), false,
        'should emit no required attribute')
    t.equal(input.getAttribute('accept'), 'image/*',
        'accept should default to image/*')
})

test('html() escapes a double quote in alt so it cannot break out ' +
    'of the attribute', async t => {
    const evil = '" onerror="alert(1)'
    const host = parse(html({ alt: evil }))
    const img = host.querySelector('img') as HTMLImageElement

    t.equal(img.getAttribute('alt'), evil,
        'the parsed alt attribute should equal the original string')
    t.equal(img.hasAttribute('onerror'), false,
        'no onerror attribute should have been injected')
})

test('html() escapes a double quote in label so it cannot break ' +
    'out of the input\'s aria-label attribute', async t => {
    const evil = '" onerror="alert(1)'
    const host = parse(html({ label: evil }))
    const input = host.querySelector(
        'input[type="file"]'
    ) as HTMLInputElement

    t.equal(input.getAttribute('aria-label'), evil,
        'the parsed aria-label attribute should equal the original ' +
        'string')
    t.equal(input.hasAttribute('onerror'), false,
        'no onerror attribute should have been injected')
})

test('html() escapes a double quote in name so it cannot break out ' +
    'of the input\'s name attribute', async t => {
    const evil = '" onerror="alert(1)'
    const host = parse(html({ name: evil }))
    const input = host.querySelector(
        'input[type="file"]'
    ) as HTMLInputElement

    t.equal(input.getAttribute('name'), evil,
        'the parsed name attribute should equal the original string')
    t.equal(input.hasAttribute('onerror'), false,
        'no onerror attribute should have been injected')
})

test('html() escapes a double quote in accept so it cannot break ' +
    'out of the input\'s accept attribute', async t => {
    const evil = '" onerror="alert(1)'
    const host = parse(html({ accept: evil }))
    const input = host.querySelector(
        'input[type="file"]'
    ) as HTMLInputElement

    t.equal(input.getAttribute('accept'), evil,
        'the parsed accept attribute should equal the original ' +
        'string')
    t.equal(input.hasAttribute('onerror'), false,
        'no onerror attribute should have been injected')
})

test('html() reflects alt onto the img and the badge', async t => {
    const withAlt = parse(html({ alt: 'a cat' }))
    const img = withAlt.querySelector('img') as HTMLImageElement
    const badge = withAlt.querySelector('.alt-badge') as HTMLElement

    t.equal(img.getAttribute('alt'), 'a cat',
        'should put alt on the preview img')
    t.equal(badge.classList.contains('has-alt'), true,
        'should mark the badge as having alt text')

    const noAlt = parse(html())
    const emptyBadge = noAlt.querySelector('.alt-badge') as HTMLElement
    t.equal(emptyBadge.classList.contains('has-alt'), false,
        'should leave the badge unmarked with no alt text')
})
