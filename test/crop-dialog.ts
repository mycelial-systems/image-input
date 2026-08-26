import { test } from '@substrate-system/tapzero'
import { cropDialog } from '../src/crop-dialog.js'
import { ImageCrop } from '../src/crop.js'
import { imageFile } from './fixture.js'

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
