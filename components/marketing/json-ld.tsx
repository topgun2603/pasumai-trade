/**
 * A block of schema.org JSON-LD.
 *
 * ## Why `dangerouslySetInnerHTML` is the correct tool here
 *
 * React escapes text children, and escaped JSON inside a `<script>` is not
 * JSON any more — `&quot;` where a crawler expects `"`. So the payload has to
 * be set as raw HTML, which is what every structured-data example does.
 *
 * The one real hazard is a string in the data containing `</script>`, which
 * would close the tag early and turn the rest of the payload into markup.
 * Escaping `<` as its unicode form prevents that: it is still valid JSON, means
 * exactly the same string to a parser, and cannot terminate the element. Our
 * data is dictionary copy rather than user input, but this costs one `replace`
 * and the day someone puts a crop description in here it will already be safe.
 *
 * Rendered from a server component, so the markup is in the delivered HTML —
 * a crawler that does not run JavaScript still sees it.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
