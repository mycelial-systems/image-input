import { test } from '@substrate-system/tapzero'
import { waitFor } from '@substrate-system/dom'
import '../src/index.js'

test('example test', async t => {
    document.body.innerHTML += `
        <image-input class="test">
        </image-input>
    `

    const el = await waitFor('image-input')

    t.ok(el, 'should find an element')
})
