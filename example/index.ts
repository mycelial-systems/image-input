import '../src/index.css'
import { ImageInput } from '../src/index.js'
import { ImageCrop } from '../src/crop.js'

document.body.innerHTML += `
    <${ImageInput.TAG}></${ImageInput.TAG}>
    <hr />
    <input type="file" accept="image/*" id="crop-file" />
    <${ImageCrop.TAG} id="crop" style="max-width:400px;"></${ImageCrop.TAG}>
`

document.getElementById('crop-file')?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    const crop = document.getElementById('crop') as ImageCrop
    if (file) crop.setFile(file)
})
