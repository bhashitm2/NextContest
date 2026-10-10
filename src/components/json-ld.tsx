/**
 * Emits a schema.org JSON-LD block.
 *
 * Search engines read this to understand *what* a page is about rather than
 * inferring it from prose — a contest is an Event with a start and end, a
 * practice problem is a LearningResource, and BreadcrumbList is the one that
 * reliably renders in the result itself.
 *
 * The payload is our own server-built object, never user input, so
 * dangerouslySetInnerHTML is safe here; `<` is still escaped so a stray value
 * can't close the script tag early.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\u003c"),
      }}
    />
  );
}
