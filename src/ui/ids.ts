/**
 * The id conventions that bind a control to the text describing it.
 *
 * A `<label htmlFor>` that does not match an `id`, or help text an
 * `aria-describedby` points at by a slightly different name, both look perfect
 * in a browser and are both broken for anyone using a screen reader. The only
 * reliable fix is to stop writing the strings twice, which is what this
 * function is for.
 *
 * It lives in its own module rather than beside `FieldShell` so that file can
 * export components and nothing else — a mixed module breaks Fast Refresh.
 */

/** The id of the help paragraph describing the control with this base id. */
export function helpId(id: string): string {
  return `${id}-help`;
}
