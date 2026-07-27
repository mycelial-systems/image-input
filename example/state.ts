import { type Signal, signal, batch } from '@preact/signals'

/**
 * The live values one `<image-input>` reports about itself.
 */
export interface ExampleSignals {
    altText:Signal<string>;
    fileName:Signal<string>;
    fileSize:Signal<number>;
    lastEvent:Signal<string>;
    errorReason:Signal<string>;
}

/**
 * A handler takes the state it writes to as its first argument, so the
 * handlers can live on `State` as statics instead of closing over one
 * instance's signals. The caller binds a handler to an instance when it
 * attaches the listener.
 */
export type StateListener = (state:ExampleSignals, ev:Event) => void

/**
 * Build the state for a single example.
 *
 * These used to be module-level signals, which was fine while the page
 * held one `<image-input>`. With several on the page, module-level
 * signals would mean every panel showed whichever input fired last, so
 * each example gets its own set instead.
 */
export function State ():ExampleSignals {
    return {
        altText: signal(''),
        fileName: signal(''),
        fileSize: signal(0),
        lastEvent: signal(''),
        errorReason: signal('')
    }
}

State.handleChange = function (state:ExampleSignals, ev:Event):void {
    const { file } = (ev as CustomEvent).detail
    const { fileName, fileSize, lastEvent, errorReason } = state

    batch(() => {
        fileName.value = file.name
        fileSize.value = file.size
        lastEvent.value = ev.type
        errorReason.value = ''
    })
}

State.handleAltChange = function (state:ExampleSignals, ev:Event):void {
    const { alt } = (ev as CustomEvent).detail
    const { altText, lastEvent } = state

    batch(() => {
        altText.value = alt
        lastEvent.value = ev.type
    })
}

State.handleRemove = function (state:ExampleSignals, ev:Event):void {
    const { fileName, fileSize, lastEvent } = state

    batch(() => {
        fileName.value = ''
        fileSize.value = 0
        lastEvent.value = ev.type
    })
}

State.handleError = function (state:ExampleSignals, ev:Event):void {
    const { reason } = (ev as CustomEvent).detail
    const { errorReason, lastEvent } = state

    batch(() => {
        errorReason.value = reason
        lastEvent.value = ev.type
    })
}

State.handleEdit = function (state:ExampleSignals, ev:Event):void {
    state.lastEvent.value = ev.type
}

State.handleAlt = function (state:ExampleSignals, ev:Event):void {
    state.lastEvent.value = ev.type
}

/**
 * One array for the whole page. The handlers no longer close over any
 * instance, so this does not need to be rebuilt per `<image-input>`.
 */
export const listeners:[string, StateListener][] = [
    ['image-input:change', State.handleChange],
    ['image-input:alt-change', State.handleAltChange],
    ['image-input:remove', State.handleRemove],
    ['image-input:error', State.handleError],
    ['image-input:edit', State.handleEdit],
    ['image-input:alt', State.handleAlt]
]
