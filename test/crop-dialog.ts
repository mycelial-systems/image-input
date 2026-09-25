import { test } from '@substrate-system/tapzero'
import { cropDialog } from '../src/crop-dialog.js'
import { ImageCrop } from '../src/crop.js'
import { imageFile, imageDataUrl } from './fixture.js'
import { waitForImageLoad } from './helpers.js'

function lastDialog ():HTMLDialogElement {
    const dialogs = document.querySelectorAll<HTMLDialogElement>(
        '.crop-dialog'
    )
    return dialogs[dialogs.length - 1]
}

test('cropDialog opens a modal for a File and forwards its constraint',
    async t => {
        const file = imageFile('photo.png', 'image/png')
        const promise = cropDialog(file, { crop: 'circle' })
        const dialogs = document.querySelectorAll('dialog')
        const dialog = dialogs[dialogs.length - 1] as HTMLDialogElement
        const crop = dialog.querySelector('image-crop') as ImageCrop

        t.ok(dialog.open, 'the dialog should be open')
        t.ok(crop, 'the dialog should contain an image-crop')
        t.equal(crop.getAttribute('crop'), 'circle',
            'the crop constraint should be forwarded')

        dialog.querySelector<HTMLButtonElement>('.crop-cancel')?.click()
        t.equal(await promise, null, 'cancel should resolve with null')
        t.equal(document.body.contains(dialog), false,
            'the dialog should be removed after closing')
    })

test('cropDialog uses default copy and passes a File to image-crop',
    async t => {
        const original = ImageCrop.prototype.setFile
        let received:File|null = null
        ImageCrop.prototype.setFile = (file:File):void => {
            received = file
        }

        try {
            const file = imageFile('photo.png', 'image/png')
            const promise = cropDialog(file)
            const dialogs = document.querySelectorAll('dialog')
            const dialog = dialogs[dialogs.length - 1] as HTMLDialogElement

            t.equal(dialog.querySelector('h2')?.textContent, 'Crop image',
                'the default heading should match the built-in copy')
            t.equal(dialog.querySelector('.crop-save')?.textContent, 'Save',
                'the default save label should match the built-in copy')
            t.equal(dialog.querySelector('.crop-cancel')?.textContent,
                'Cancel',
                'the default cancel label should match the built-in copy')
            t.equal(received, file,
                'a File source should be passed to image-crop.setFile')

            dialog.querySelector<HTMLButtonElement>('.crop-cancel')?.click()
            t.equal(await promise, null, 'cancel should resolve with null')
        } finally {
            ImageCrop.prototype.setFile = original
        }
    })

test('cropDialog saves the cropped Blob and supports custom copy', async t => {
    const original = ImageCrop.prototype.getBlob
    const blob = new Blob(['cropped'], { type: 'image/png' })
    ImageCrop.prototype.getBlob = async () => blob

    try {
        const promise = cropDialog('photo.png', {
            heading: 'Trim photo',
            save: 'Keep',
            cancel: 'Discard'
        })
        const dialogs = document.querySelectorAll('dialog')
        const dialog = dialogs[dialogs.length - 1] as HTMLDialogElement

        t.equal(dialog.querySelector('h2')?.textContent, 'Trim photo')
        t.equal(dialog.querySelector('.crop-save')?.textContent, 'Keep')
        t.equal(dialog.querySelector('.crop-cancel')?.textContent, 'Discard')
        dialog.querySelector<HTMLButtonElement>('.crop-save')?.click()

        t.equal(await promise, blob, 'save should resolve with the Blob')
        t.equal(document.body.contains(dialog), false,
            'the dialog should be removed after saving')
    } finally {
        ImageCrop.prototype.getBlob = original
    }
})

test('cropDialog promotes a Blob source to a File', async t => {
    const original = ImageCrop.prototype.setFile
    let received:File|null = null
    ImageCrop.prototype.setFile = (file:File):void => {
        received = file
    }

    try {
        const source = new Blob(['image'], { type: 'image/png' })
        const promise = cropDialog(source)
        const dialog = lastDialog()

        t.ok(received instanceof File,
            'a Blob source should be promoted to a File')
        t.equal(received?.type, 'image/png',
            'the promoted File should preserve the Blob type')

        dialog.querySelector<HTMLButtonElement>('.crop-cancel')?.click()
        t.equal(await promise, null, 'cancel should resolve with null')
    } finally {
        ImageCrop.prototype.setFile = original
    }
})

test('cropDialog forwards string and object crop constraints', async t => {
    const first = cropDialog('photo.png', {
        crop: {
            kind: 'ratio',
            ratio: 4 / 3,
            circle: false
        }
    })
    const firstDialog = lastDialog()
    const firstCrop = firstDialog.querySelector('image-crop')
    t.equal(firstCrop?.getAttribute('crop'), '1.3333333333333333',
        'a ratio constraint should be serialized to its literal value')
    firstDialog.querySelector<HTMLButtonElement>('.crop-cancel')?.click()
    await first

    const second = cropDialog('photo.png', { crop: { kind: 'constrain' } })
    const secondDialog = lastDialog()
    const secondCrop = secondDialog.querySelector('image-crop')
    t.equal(secondCrop?.getAttribute('crop'), 'constrain',
        'a constrain object should be forwarded')
    secondDialog.querySelector<HTMLButtonElement>('.crop-cancel')?.click()
    await second
})

test('cropDialog resolves null for Escape and backdrop dismissal', async t => {
    const escapePromise = cropDialog('photo.png')
    const escapeDialog = lastDialog()
    escapeDialog.dispatchEvent(new Event('cancel', {
        bubbles: true,
        cancelable: true
    }))
    t.equal(await escapePromise, null,
        'Escape cancellation should resolve with null')

    const backdropPromise = cropDialog('photo.png')
    const backdropDialog = lastDialog()
    backdropDialog.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true
    }))
    t.equal(await backdropPromise, null,
        'backdrop dismissal should resolve with null')
})

test('cropDialog ignores a second Save while getBlob is in flight',
    async t => {
        const original = ImageCrop.prototype.getBlob
        let resolveBlob:(blob:Blob) => void = () => undefined
        const blobPromise = new Promise<Blob>(resolve => {
            resolveBlob = resolve
        })
        let calls = 0
        ImageCrop.prototype.getBlob = async ():Promise<Blob> => {
            calls++
            return blobPromise
        }

        try {
            const promise = cropDialog('photo.png')
            const dialog = lastDialog()
            const save = dialog.querySelector<HTMLButtonElement>(
                '.crop-save'
            ) as HTMLButtonElement

            save.click()
            save.click()
            t.equal(calls, 1, 'only one getBlob call should be in flight')

            const blob = new Blob(['cropped'], { type: 'image/png' })
            resolveBlob(blob)
            t.equal(await promise, blob,
                'the first Save should resolve with the crop')
        } finally {
            ImageCrop.prototype.getBlob = original
        }
    })

test('cropDialog rejects and cleans up when getBlob fails', async t => {
    const original = ImageCrop.prototype.getBlob
    const failure = new Error('canvas failed')
    ImageCrop.prototype.getBlob = async ():Promise<Blob> => {
        throw failure
    }

    try {
        const promise = cropDialog('photo.png')
        const dialog = lastDialog()
        dialog.querySelector<HTMLButtonElement>('.crop-save')?.click()

        let received:unknown = null
        try {
            await promise
        } catch (error) {
            received = error
        }

        t.equal(received, failure,
            'the getBlob failure should reject the dialog promise')
        t.equal(document.body.contains(dialog), false,
            'the failed dialog should be removed')
    } finally {
        ImageCrop.prototype.getBlob = original
    }
})

test('AC6.3 crossorigin: cropDialog forwards crossorigin to image-crop',
    async t => {
        const promise = cropDialog('/fixtures/photo.png',
            { crossorigin: 'anonymous' })
        const dialog = lastDialog()
        const crop = dialog.querySelector('image-crop')

        t.equal(crop?.getAttribute('crossorigin'), 'anonymous',
            'the dialog should set crossorigin on image-crop')

        dialog.querySelector<HTMLButtonElement>('.crop-cancel')?.click()
        t.equal(await promise, null, 'cancel should resolve with null')
    })

test('AC6.3 type: cropDialog guesses type from URL extension and ' +
    'returns correct blob type', async t => {
    const promise = cropDialog('/fixtures/photo.png')
    const dialog = lastDialog()
    const crop = dialog.querySelector('image-crop') as ImageCrop
    await waitForImageLoad(crop)

    dialog.querySelector<HTMLButtonElement>('.crop-save')?.click()
    const result = await promise

    t.equal(result?.type, 'image/png',
        'the resolved blob should be image/png')
})

test('AC6.3 type: cropDialog uses dataUrl type fallback when there ' +
    'is no extension', async t => {
    const promise = cropDialog(imageDataUrl())
    const dialog = lastDialog()
    const crop = dialog.querySelector('image-crop') as ImageCrop
    await waitForImageLoad(crop)

    dialog.querySelector<HTMLButtonElement>('.crop-save')?.click()
    const result = await promise

    t.equal(result?.type, 'image/jpeg',
        'the resolved blob should be image/jpeg')
})
