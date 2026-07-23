import '../src/index.css'
import './index.css'
import { ImageInput } from '../src/index.js'
import { ImageCrop } from '../src/crop.js'

document.body.innerHTML += `
    <${ImageInput.TAG} id="input"></${ImageInput.TAG}>

    <dialog id="crop-dialog">
        <${ImageCrop.TAG} id="crop"></${ImageCrop.TAG}>
        <menu>
            <button type="button" id="crop-cancel">Cancel</button>
            <button type="button" id="crop-save">Save</button>
        </menu>
    </dialog>

    <dialog id="alt-dialog">
        <label for="alt-textarea">Alt text</label>
        <textarea id="alt-textarea" rows="4"></textarea>
        <menu>
            <button type="button" id="alt-cancel">Cancel</button>
            <button type="button" id="alt-save">Save</button>
        </menu>
    </dialog>
`

const input = document.getElementById('input') as ImageInput

const cropDialog = document.getElementById(
    'crop-dialog'
) as HTMLDialogElement
const crop = document.getElementById('crop') as ImageCrop
const cropSave = document.getElementById('crop-save') as HTMLButtonElement
const cropCancel = document.getElementById(
    'crop-cancel'
) as HTMLButtonElement

const altDialog = document.getElementById('alt-dialog') as HTMLDialogElement
const altTextarea = document.getElementById(
    'alt-textarea'
) as HTMLTextAreaElement
const altSave = document.getElementById('alt-save') as HTMLButtonElement
const altCancel = document.getElementById('alt-cancel') as HTMLButtonElement

input.addEventListener('image-input:edit', ((e:CustomEvent) => {
    const { file } = e.detail
    crop.setFile(file)
    cropDialog.showModal()
}) as EventListener)

cropSave.addEventListener('click', () => {
    crop.getBlob().then(blob => {
        input.setImage(blob)
        cropDialog.close()
    })
})

cropCancel.addEventListener('click', () => cropDialog.close())

input.addEventListener('image-input:alt', ((e:CustomEvent) => {
    const { alt } = e.detail
    altTextarea.value = alt
    altDialog.showModal()
}) as EventListener)

altSave.addEventListener('click', () => {
    input.alt = altTextarea.value
    altDialog.close()
})

altCancel.addEventListener('click', () => altDialog.close())
