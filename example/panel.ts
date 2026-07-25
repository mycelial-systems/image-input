import { html } from 'htm/preact'
import { type Signal, computed } from '@preact/signals'
import { EN_DASH } from './constants.js'
import {
    altText,
    fileName,
    fileSize,
    lastEvent,
    errorReason,
} from './state.js'

/**
 * Show an en dash in place of an empty value.
 */
function orDash (sig:Signal<string>):Signal<string> {
    return computed(() => sig.value || EN_DASH)
}

const altTextText = orDash(altText)
const fileNameText = orDash(fileName)
const lastEventText = orDash(lastEvent)
const errorReasonText = orDash(errorReason)

export function Panel () {
    return html`
        <dl class="panel">
            <dt>alt text</dt>
            <dd>${altTextText}</dd>

            <dt>file name</dt>
            <dd>${fileNameText}</dd>

            <dt>file size</dt>
            <dd>${fileSize}</dd>

            <dt>last event</dt>
            <dd>${lastEventText}</dd>

            <dt>error reason</dt>
            <dd>${errorReasonText}</dd>
        </dl>
    `
}
