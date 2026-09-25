// pattern: Imperative Shell

import { ImageCrop } from './crop.js'
import { DEFAULT_TEXT } from './dialogs.js'
import { escapeAttr } from './escape.js'
import { toFile, encodableType, guessType } from './file.js'
import type { CropConstraint } from './crop-math.js'

export type CropDialogOptions = {
    heading?:string
    save?:string
    cancel?:string
    crop?:CropConstraint|string
    crossorigin?:string
}

export type CropSource = File|Blob|string

function markup (
    options:Required<Omit<CropDialogOptions, 'crop'|'crossorigin'>>
):string {
    return `<dialog class="crop-dialog" aria-label="${
        escapeAttr(options.heading)
    }">
        <h2>${escapeAttr(options.heading)}</h2>
        <div class="crop-slot"><image-crop></image-crop></div>
        <menu>
            <li><button type="button" class="crop-cancel">${
                escapeAttr(options.cancel)
            }</button></li>
            <li><button type="button" class="crop-save">${
                escapeAttr(options.save)
            }</button></li>
        </menu>
    </dialog>`
}

/** Open a temporary crop dialog and resolve with the saved crop or null. */
export function cropDialog (
    source:CropSource,
    options:CropDialogOptions = {}
):Promise<Blob|null> {
    const text = {
        heading: options.heading ?? DEFAULT_TEXT.cropHeading,
        save: options.save ?? DEFAULT_TEXT.save,
        cancel: options.cancel ?? DEFAULT_TEXT.cancel
    }
    const container = document.createElement('div')
    container.innerHTML = markup(text)
    const dialog = container.firstElementChild as HTMLDialogElement
    const crop = dialog.querySelector<ImageCrop>(ImageCrop.TAG)
    if (!crop) return Promise.resolve(null)
    document.body.appendChild(dialog)
    if (options.crop !== undefined) {
        const value = typeof options.crop === 'string' ?
            options.crop : options.crop.kind === 'ratio' &&
                options.crop.circle ?
                'circle' : options.crop.kind === 'ratio' ?
                    String(options.crop.ratio) : options.crop.kind
        crop.setAttribute('crop', value)
    }
    if (options.crossorigin !== undefined) {
        crop.setAttribute('crossorigin', options.crossorigin)
    }
    if (source instanceof File) crop.setFile(source)
    else if (source instanceof Blob) crop.setFile(toFile(source))
    else crop.setAttribute('src', source)

    const type = typeof source === 'string' ?
        encodableType(guessType(source)) :
        undefined

    dialog.showModal()

    return new Promise((resolve, reject) => {
        let settled = false
        let saving = false
        const finish = (result:Blob|null):void => {
            if (settled) return
            settled = true
            dialog.remove()
            resolve(result)
        }
        const fail = (error:unknown):void => {
            if (settled) return
            settled = true
            dialog.close()
            dialog.remove()
            reject(error)
        }
        const cancel = (event:Event):void => {
            event.preventDefault()
            dialog.close()
            finish(null)
        }
        const save = async (event:Event):Promise<void> => {
            event.preventDefault()
            if (saving || settled) return
            saving = true
            try {
                const blob = await crop.getBlob({ type })
                if (!settled && dialog.open) {
                    dialog.close()
                    finish(blob)
                }
            } catch (error:unknown) {
                fail(error)
            } finally {
                saving = false
            }
        }
        dialog.querySelector('.crop-cancel')?.addEventListener(
            'click', cancel)
        dialog.querySelector('.crop-save')?.addEventListener('click', save)
        dialog.addEventListener('cancel', cancel)
        dialog.addEventListener('click', event => {
            if (event.target === dialog) cancel(event)
        })
        dialog.addEventListener('close', () => finish(null), { once: true })
    })
}
