import { html } from 'htm/preact'
import { type ExampleSignals } from './state.js'

interface ControlsProps {
    signals:ExampleSignals;
    onSave:() => void;
    onClear:() => void;
    onToggleStored:() => void;
}

/**
 * Three buttons demonstrating different API approaches.
 *
 * Save listens: it is enabled only once the component has reported alt
 * text through `image-input:alt-change`, and nothing on this page ever
 * asks the element for its state. Clear calls: it invokes the
 * component's `clear()` method (see `Example` in `index.ts`). Stored
 * image sets `src` on the element through the ref imperatively, not
 * as a vdom prop (see rule 1 in `example/AGENTS.md`), and also resets
 * the element's `alt` to `null`.
 *
 * `signals.altText.value` is read here rather than in `Example` so the
 * subscription stays out of the subtree holding the `<image-input>`
 * vnode -- see rule 5 in `example/AGENTS.md`. It is read directly
 * instead of through a `computed`, since a bare boolean allocates
 * nothing per render.
 */
export function Controls ({
    signals,
    onSave,
    onClear,
    onToggleStored
}:ControlsProps) {
    const canSave = !!signals.altText.value

    // Not `.controls` -- the component's own overlay already uses that
    // class name, and this page's CSS is not scoped away from the
    // component's markup.
    return html`
        <div class="actions">
            <button
                type="button"
                class="save"
                disabled=${!canSave}
                onClick=${onSave}
            >Save</button>

            <button
                type="button"
                class="clear"
                onClick=${onClear}
            >Clear</button>

            <button
                type="button"
                class="stored"
                onClick=${onToggleStored}
            >Stored image</button>

            ${canSave ? null : html`
                <p class="hint">Add alt text to save.</p>
            `}
        </div>
    `
}
