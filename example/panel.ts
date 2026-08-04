import { html } from 'htm/preact'
import { useMemo } from 'preact/hooks'
import { type Signal, computed } from '@preact/signals'
import { humanBytes } from '@substrate-system/human-bytes'
import { EN_DASH } from './constants.js'
import { type ExampleSignals } from './state.js'

/**
 * Show an en dash in place of an empty value.
 */
function orDash (sig:Signal<string>):Signal<string> {
    return computed(() => sig.value || EN_DASH)
}

/**
 * A byte count as something readable. Zero means there is no file, not a
 * zero-length one, so it gets the same en dash as the empty strings.
 */
function humanSize (sig:Signal<number>):Signal<string> {
    return computed(() => (sig.value ? humanBytes(sig.value) : EN_DASH))
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
        fileSizeText,
        lastEventText,
        errorReasonText,
        savedText
    } = useMemo(() => ({
        altText: orDash(signals.altText),
        fileNameText: orDash(signals.fileName),
        fileSizeText: humanSize(signals.fileSize),
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
            <dd>${fileSizeText}</dd>

            <dt>last event</dt>
            <dd>${lastEventText}</dd>

            <dt>error reason</dt>
            <dd>${errorReasonText}</dd>

            <dt>saved</dt>
            <dd>${savedText}</dd>
        </dl>
    `
}
