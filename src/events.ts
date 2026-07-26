/**
 * The `image-input:*` events, and their `detail` shapes.
 *
 * Both emitters -- `ImageInput` (via `WebComponent.emit`) and
 * `ImageInputClient` (via its injected `emit`) -- dispatch this same
 * set, so the map lives here rather than in either one. Keys are the
 * *non*-namespaced names taken by `ImageInput.on()`/`.off()`; the
 * namespaced names (`image-input:change`, ...) are what
 * `addEventListener` sees, and they are augmented onto
 * `HTMLElementEventMap` below.
 */
export interface ImageInputEventMap {
    change:CustomEvent<{ file:File, alt:string }>
    'alt-change':CustomEvent<{ alt:string }>
    remove:CustomEvent<null>
    error:CustomEvent<{ reason:'not-an-image' }>
    edit:CustomEvent<{ file:File }>
    alt:CustomEvent<{ file:File, alt:string }>
}

/**
 * These events bubble, so listening on an ancestor -- a form, or
 * `document.body` -- is a supported pattern, not just listening on the
 * `<image-input>` itself. Typing them on `HTMLElementEventMap` (rather
 * than overriding `addEventListener` on `ImageInput` alone) is what
 * makes those ancestor listeners typed too. The cost is that the six
 * namespaced keys exist on every `HTMLElement` in a consuming project.
 */
declare global {
    interface HTMLElementEventMap {
        'image-input:change':ImageInputEventMap['change']
        'image-input:alt-change':ImageInputEventMap['alt-change']
        'image-input:remove':ImageInputEventMap['remove']
        'image-input:error':ImageInputEventMap['error']
        'image-input:edit':ImageInputEventMap['edit']
        'image-input:alt':ImageInputEventMap['alt']
    }
}
