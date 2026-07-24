export interface ImageInputHtmlOptions {
    accept?:string|null;
    name?:string|null;
    required?:boolean;
    alt?:string|null;
}

/**
 * Produce the markup for an image input.
 *
 * This is presentation only -- it does not attach any behavior. Put the
 * resulting HTML in the document, then wire it up with
 * `ImageInputClient` (see `./client.ts`).
 */
export function html (opts:ImageInputHtmlOptions = {}):string {
    const accept = opts.accept ?? 'image/*'
    const name = opts.name ? ` name="${opts.name}"` : ''
    const required = opts.required ? ' required' : ''
    const alt = opts.alt ?? ''
    const hasAlt = !!opts.alt

    return `<div class="wrapper">
            <input
                type="file"
                accept="${accept}"
                ${name}
                ${required}
            />
            <div class="preview">
                <img alt="${alt}" />
                <div class="overlay">
                    <button
                        type="button"
                        class="alt-badge${hasAlt ? ' has-alt' : ''}"
                        aria-label="${hasAlt ? 'Edit alt text' : 'Add alt text'}"
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
        </div>`
}
