/**
 * Markup builders and small open/close helpers for the two dialogs
 * `<image-input>` renders itself: the alt-text dialog and the crop
 * dialog. Kept separate from index.ts so that file does not grow past
 * 400 lines.
 *
 * Neither dialog markup carries an `id`, a `for`, or an
 * `aria-labelledby` attribute -- ten `<image-input>` elements on one
 * page would otherwise emit ten duplicate ids. Each dialog uses
 * `aria-label` instead, and the alt textarea relies on implicit
 * labelling: a `<textarea>` is its wrapping `<label>`'s own control,
 * so no `for`/`id` pair is needed. See the note in src/AGENTS.md.
 */

export interface DialogText {
    altHeading:string
    altLabel:string
    cropHeading:string
    save:string
    cancel:string
}

/**
 * Markup for the alt-text dialog. Closed by default -- callers decide
 * when to open it.
 */
export function altDialogMarkup (text:DialogText):string {
    return `<dialog class="alt-dialog" aria-label="${text.altHeading}">
        <h2>${text.altHeading}</h2>
        <label>
            <span>${text.altLabel}</span>
            <textarea rows="4"></textarea>
        </label>
        <menu>
            <button type="button" class="alt-cancel"
            >${text.cancel}</button>
            <button type="button" class="alt-save"
            >${text.save}</button>
        </menu>
    </dialog>`
}

/**
 * Markup for the crop dialog. `.crop-slot` starts empty; a later
 * story fills it with a lazily created `<image-crop>`.
 */
export function cropDialogMarkup (text:DialogText):string {
    return `<dialog class="crop-dialog" aria-label="${text.cropHeading}">
        <h2>${text.cropHeading}</h2>
        <div class="crop-slot"></div>
        <menu>
            <button type="button" class="crop-cancel"
            >${text.cancel}</button>
            <button type="button" class="crop-save"
            >${text.save}</button>
        </menu>
    </dialog>`
}

/**
 * Open a dialog, guarding against `showModal()`'s InvalidStateError
 * when it is called on a dialog that is already open.
 */
export function openDialog (dialog:HTMLDialogElement):void {
    if (!dialog.open) dialog.showModal()
}

/**
 * Close a dialog. A thin wrapper so callers import open/close as a
 * pair from one place.
 */
export function closeDialog (dialog:HTMLDialogElement):void {
    dialog.close()
}
