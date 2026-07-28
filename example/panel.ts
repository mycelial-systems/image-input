import { html } from 'htm/preact'
import { useMemo } from 'preact/hooks'
import { type Signal, computed } from '@preact/signals'
import { EN_DASH } from './constants.js'
import { type ExampleSignals } from './state.js'

/**
 * Show an en dash in place of an empty value.
 */
function orDash (sig:Signal<string>):Signal<string> {
    return computed(() => sig.value || EN_DASH)
}

/**
 * The signals are read here, not in `App` or `Example` -- see rule 5 in
 * `example/AGENTS.md`. The `computed`s are memoized so a re-render does
 * not build a fresh set on every pass.
 */
export function Panel ({ signals }:{ signals:ExampleSignals }) {
    const {
        altText,
        fileNameText,
        lastEventText,
        errorReasonText,
        savedText
    } = useMemo(() => ({
        altText: orDash(signals.altText),
        fileNameText: orDash(signals.fileName),
        lastEventText: orDash(signals.lastEvent),
        errorReasonText: orDash(signals.errorReason),
        savedText: orDash(signals.saved)
    }), [signals])

    return html`
        <dl class="panel">
            <dt>alt text</dt>
            <dd>${altText}</dd>

            <dt>file name</dt>
            <dd>${fileNameText}</dd>

            <dt>file size</dt>
            <dd>${signals.fileSize}</dd>

            <dt>last event</dt>
            <dd>${lastEventText}</dd>

            <dt>error reason</dt>
            <dd>${errorReasonText}</dd>

            <dt>saved</dt>
            <dd>${savedText}</dd>
        </dl>
    `
}
