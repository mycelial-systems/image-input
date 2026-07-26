import '../src/index.css'
import './index.css'
import { render, type VNode } from 'preact'
import { useEffect, useMemo, useRef } from 'preact/hooks'
import { html } from 'htm/preact'
import { ImageInput } from '../src/index.js'
import { Panel } from './panel.js'
import { createStore } from './state.js'
import Debug from '@substrate-system/debug'
const debug = Debug(true)

interface ExampleProps {
    crop?:string;
    heading:VNode;
    description:string;
}

/**
 * One entry per `<image-input>` on the page. This is a module-level
 * constant of fixed length and order, so each `Example` vnode keeps a
 * stable position across renders and no `key` is needed -- see rule 4
 * in `example/AGENTS.md`.
 */
const EXAMPLES:ExampleProps[] = [
    {
        heading: html`No crop attribute (free-form)`,
        description: 'The crop rectangle can be dragged and resized ' +
            'to any shape.'
    },
    {
        crop: 'circle',
        heading: html`<code>crop="circle"</code>`,
        description: 'Locks to 1:1 and draws the crop area as a ' +
            'circle. The circle is UI only -- the saved image is a ' +
            'cropped square with its corners intact. Round it with CSS.'
    },
    {
        crop: 'constrain',
        heading: html`<code>crop="constrain"</code>`,
        description: "Locks the crop to the source image's own aspect ratio."
    },
    {
        crop: '4/3',
        heading: html`<code>crop="4/3"</code>`,
        description: 'Locks the crop to a fixed 4:3 aspect ratio.'
    },
    {
        crop: '1',
        heading: html`<code>crop="1"</code>`,
        description: 'Use a square aspect ratio.'
    }
]

function Example ({ crop, heading, description }:ExampleProps) {
    const ref = useRef<ImageInput>(null)
    const store = useMemo(createStore, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return

        for (const [name, listener] of store.listeners) {
            el.addEventListener(name, listener)
        }

        /**
         * Types are inferred correctly here. The handler stays inline
         * -- that inference is the point of this block -- so it is
         * removed with an `AbortController` rather than by name.
         * `on()` passes its options straight to `addEventListener`.
         */
        const controller = new AbortController()
        el.on('change', (ev) => {
            debug('got a "change" event with the .on method', ev)
            debug('file name', ev.detail.file.name)
        }, { signal: controller.signal })

        return () => {
            for (const [name, listener] of store.listeners) {
                el.removeEventListener(name, listener)
            }
            controller.abort()
        }
    }, [])

    /**
     * Omit the attribute entirely for the free-form example, rather
     * than passing an empty or null `crop`. The value is fixed per
     * instance, so this never changes across renders (rule 1).
     */
    const cropAttr = crop ? { crop } : {}

    return html`
        <section class="example">
            <h2>${heading}</h2>
            <p>${description}</p>
            <${ImageInput.TAG}
                ref=${ref}
                accept="image/*"
                ...${cropAttr}
            />
            <${Panel} signals=${store.signals} />
        </section>
    `
}

function App () {
    return html`
        ${EXAMPLES.map(example => {
            return html`<${Example} ...${example} />`
        })}
    `
}

render(html`<${App} />`, document.getElementById('app') as HTMLElement)
