import {
    altDialogMarkup,
    cropDialogMarkup,
    DEFAULT_TEXT,
    type DialogText
} from './dialogs.js'

/**
 * Prompt text for an empty box, and the file input's `aria-label`.
 */
export const DEFAULT_LABEL = 'Drop an image, or click to choose one'

/**
 * Escape a string for safe interpolation inside a double-quoted HTML
 * attribute. `&` must run first, or the entities this introduces
 * would themselves get escaped.
 */
function escapeAttr (value:string):string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export interface ImageInputHtmlOptions {
    accept?:string|null;
    name?:string|null;
    required?:boolean;
    alt?:string|null;
    label?:string|null;
    text?:DialogText;
    /**
     * Emit the built-in alt and crop dialogs. On by default. Pass
     * `false` when the consumer supplies its own editing UI and
     * cancels `image-input:edit` / `image-input:alt`.
     */
    dialogs?:boolean;
}

/**
 * Produce the markup for an image input.
 *
 * This is the only place this package writes that markup.
 * `ImageInput.render()` calls it too, so the custom element and the
 * server-rendered page cannot drift apart. It is presentation only --
 * it attaches no behavior. Put the result in the document, then wire
 * it up with `ImageInputClient` (see `./client.ts`).
 */
export function html (opts:ImageInputHtmlOptions = {}):string {
    const accept = escapeAttr(opts.accept ?? 'image/*')
    const name = opts.name ?
        ` name="${escapeAttr(opts.name)}"` :
        ''
    const required = opts.required ? ' required' : ''
    const alt = escapeAttr(opts.alt ?? '')
    const hasAlt = !!opts.alt
    const label = escapeAttr(opts.label ?? DEFAULT_LABEL)
    const text = opts.text ?? DEFAULT_TEXT
    const wantsDialogs = opts.dialogs ?? true

    const dialogs = wantsDialogs ?
        `${altDialogMarkup(text)}
        ${cropDialogMarkup(text)}` :
        ''

    return `<div class="box">
            <label class="picker">
                <input
                    type="file"
                    accept="${accept}"${name}${required}
                    aria-label="${label}"
                />
                <span class="prompt">
                    <svg class="prompt-icon" aria-hidden="true"
                        viewBox="0 0 24 24"
                    >
                        <path d="M12 16V4M12 4l-5 5M12 4l5 5" />
                        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0
                            0 1-1v-3" />
                    </svg>
                    <span class="prompt-text">${label}</span>
                </span>
            </label>
            <div class="preview">
                <img alt="${alt}" />
                <div class="overlay">
                    <button
                        type="button"
                        class="alt-badge${hasAlt ? ' has-alt' : ''}"
                        aria-label="${hasAlt ?
                            'Edit alt text' :
                            'Add alt text'}"
                    ><span class="plus" aria-hidden="true">+</span>ALT</button>
                    <div class="controls">
                        <button type="button" class="edit"
                            aria-label="Edit image"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0
                                    -3-3L5 17v3z" />
                            </svg>
                        </button>
                        <button type="button" class="remove"
                            aria-label="Remove image"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M5 5l14 14M19 5L5 19" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        ${dialogs}`
}
