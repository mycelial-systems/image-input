import { signal, batch } from '@preact/signals'

export const altText = signal('')
export const fileName = signal('')
export const fileSize = signal(0)
export const lastEvent = signal('')
export const errorReason = signal('')

export function handleChange (event:Event):void {
    const { file } = (event as CustomEvent).detail
    batch(() => {
        fileName.value = file.name
        fileSize.value = file.size
        lastEvent.value = event.type
        errorReason.value = ''
    })
}

export function handleAltChange (event:Event):void {
    const { alt } = (event as CustomEvent).detail
    batch(() => {
        altText.value = alt
        lastEvent.value = event.type
    })
}

export function handleRemove (event:Event):void {
    batch(() => {
        fileName.value = ''
        fileSize.value = 0
        lastEvent.value = event.type
    })
}

export function handleError (event:Event):void {
    const { reason } = (event as CustomEvent).detail
    batch(() => {
        errorReason.value = reason
        lastEvent.value = event.type
    })
}

export function handleEdit (event:Event):void {
    lastEvent.value = event.type
}

export function handleAlt (event:Event):void {
    lastEvent.value = event.type
}
