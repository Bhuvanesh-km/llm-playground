/**
 * The circled initial that stands in for a model everywhere it is named. Plain
 * and uniform on purpose: giving each model its own colour is listed in
 * scope.md as a nice-to-have, and a palette of nineteen arbitrary colours would
 * compete with rust, green and red, which all already mean something specific.
 */
export const ModelBadge = ({ name }: { readonly name: string }) => (
  <span
    aria-hidden
    className="border-strong text-muted-ink flex size-6 shrink-0 items-center justify-center rounded-full border text-xs"
  >
    {name.trim().charAt(0).toUpperCase()}
  </span>
);
