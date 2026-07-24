import '../src/index.css'
import './index.css'
import { render } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { signal } from '@preact/signals'
import { html } from 'htm/preact'
import { dragDrop } from '@substrate-system/drag-drop'
import { ImageInput } from '../src/index.js'
import { ImageCrop } from '../src/crop.js'

const altValue = signal('')
const altDraft = signal('')

function App () {
    const input = useRef<ImageInput>(null)
    const crop = useRef<ImageCrop>(null)
    const cropDialog = useRef<HTMLDialogElement>(null)
    const altDialog = useRef<HTMLDialogElement>(null)
    const dropZone = useRef<HTMLDivElement>(null)
    // Set while committing a cropped blob back via setImage, so the
    // resulting change event does not re-open the crop dialog.
    const suppressCrop = useRef(false)

    /**
     * Listen for custom events
     */
    useEffect(() => {
        const el = input.current
        const zone = dropZone.current
        if (!el || !zone) return

        const openCrop = (file:File) => {
            crop.current?.setFile(file)
            cropDialog.current?.showModal()
        }

        const onEdit = (e:CustomEvent) => {
            openCrop(e.detail.file)
        }

        // A new image arrived (file picker or drop) -- let the user crop
        // it before committing, unless we are the ones committing a crop.
        const onChange = (e:CustomEvent) => {
            if (suppressCrop.current) {
                suppressCrop.current = false
                return
            }
            openCrop(e.detail.file)
        }

        const onAlt = (e:CustomEvent) => {
            altDraft.value = e.detail.alt
            altDialog.current?.showModal()
        }

        const onAltChange = (e:CustomEvent) => {
            altValue.value = e.detail.alt
        }

        el.addEventListener('image-input:edit', onEdit as EventListener)
        el.addEventListener('image-input:change', onChange as EventListener)
        el.addEventListener('image-input:alt', onAlt as EventListener)
        el.addEventListener(
            'image-input:alt-change',
            onAltChange as EventListener
        )

        const teardown = dragDrop(zone, (dropped) => {
            const file = Object.values(dropped).find((f):f is File => {
                return f instanceof File && f.type.startsWith('image/')
            })
            if (file) ImageInput.setImage(el, file)
        })

        return () => {
            el.removeEventListener('image-input:edit', onEdit as EventListener)
            el.removeEventListener(
                'image-input:change',
                onChange as EventListener
            )
            el.removeEventListener('image-input:alt', onAlt as EventListener)
            el.removeEventListener(
                'image-input:alt-change',
                onAltChange as EventListener
            )
            if (typeof teardown === 'function') teardown()
        }
    }, [])

    const saveCrop = () => {
        crop.current?.getBlob().then(blob => {
            suppressCrop.current = true
            input.current?.setImage(blob)
            cropDialog.current?.close()
        })
    }

    const saveAlt = () => {
        if (input.current) input.current.alt = altDraft.value
        altDialog.current?.close()
    }

    return html`
        <div id="drop-zone" ref=${dropZone}>
            <${ImageInput.TAG} ref=${input} id="input"></${ImageInput.TAG}>
            <p>Drop an image here, or use the file picker above.</p>
        </div>
        <div id="alt-display">
            The alt text: <span>${altValue.value}</span>
        </div>

        <dialog id="crop-dialog" ref=${cropDialog}>
            <${ImageCrop.TAG} ref=${crop} id="crop"></${ImageCrop.TAG}>
            <menu>
                <button onClick=${() => cropDialog.current?.close()}>
                    Cancel
                </button>
                <button type="button" onClick=${saveCrop}>Save</button>
            </menu>
        </dialog>

        <dialog id="alt-dialog" ref=${altDialog}>
            <label for="alt-textarea">Alt text</label>
            <textarea
                id="alt-textarea"
                rows="4"
                value=${altDraft.value}
                onInput=${(e:Event) => {
                    altDraft.value = (e.target as HTMLTextAreaElement).value
                }}
            ></textarea>
            <menu>
                <button
                    type="button"
                    onClick=${() => altDialog.current?.close()}
                >Cancel</button>
                <button type="button" onClick=${saveAlt}>Save</button>
            </menu>
        </dialog>
    `
}

const root = document.createElement('div')
document.body.appendChild(root)
render(html`<${App} />`, root)
