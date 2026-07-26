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
 * One example's signals plus the listeners that write them, paired as
 * `[eventName, listener]` so the caller can add and remove the whole
 * set in a symmetric loop.
 */
export interface ExampleStore {
    signals:ExampleSignals;
    listeners:[string, EventListener][];
}

/**
 * Build the state for a single example.
 *
 * These used to be module-level signals, which was fine while the page
 * held one `<image-input>`. With several on the page, module-level
 * signals would mean every panel showed whichever input fired last, so
 * each example gets its own set instead.
 */
export function createStore ():ExampleStore {
    const signals:ExampleSignals = {
        altText: signal(''),
        fileName: signal(''),
        fileSize: signal(0),
        lastEvent: signal(''),
        errorReason: signal('')
    }

    const {
        altText,
        fileName,
        fileSize,
        lastEvent,
        errorReason
    } = signals

    function handleChange (event:Event):void {
        const { file } = (event as CustomEvent).detail
        batch(() => {
            fileName.value = file.name
            fileSize.value = file.size
            lastEvent.value = event.type
            errorReason.value = ''
        })
    }

    function handleAltChange (event:Event):void {
        const { alt } = (event as CustomEvent).detail
        batch(() => {
            altText.value = alt
            lastEvent.value = event.type
        })
    }

    function handleRemove (event:Event):void {
        batch(() => {
            fileName.value = ''
            fileSize.value = 0
            lastEvent.value = event.type
        })
    }

    function handleError (event:Event):void {
        const { reason } = (event as CustomEvent).detail
        batch(() => {
            errorReason.value = reason
            lastEvent.value = event.type
        })
    }

    function handleEdit (event:Event):void {
        lastEvent.value = event.type
    }

    function handleAlt (event:Event):void {
        lastEvent.value = event.type
    }

    const listeners:[string, EventListener][] = [
        ['image-input:change', handleChange],
        ['image-input:alt-change', handleAltChange],
        ['image-input:remove', handleRemove],
        ['image-input:error', handleError],
        ['image-input:edit', handleEdit],
        ['image-input:alt', handleAlt]
    ]

    return { signals, listeners }
}
