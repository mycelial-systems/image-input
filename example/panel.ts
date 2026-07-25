import { html } from 'htm/preact'
import {
    altText,
    fileName,
    fileSize,
    lastEvent,
    errorReason,
} from './state.js'

export function Panel () {
    return html`
        <dl class="panel">
            <dt>alt text</dt>
            <dd>${altText}</dd>

            <dt>file name</dt>
            <dd>${fileName}</dd>

            <dt>file size</dt>
            <dd>${fileSize}</dd>

            <dt>last event</dt>
            <dd>${lastEvent}</dd>

            <dt>error reason</dt>
            <dd>${errorReason}</dd>
        </dl>
    `
}
