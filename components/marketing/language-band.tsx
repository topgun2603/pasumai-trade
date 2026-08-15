import { CATALOGUE } from "@/lib/mock/catalogue";
import { LOCALES, LOCALE_META } from "@/lib/i18n/config";
import { produceName } from "@/lib/domain/models";
import { SectionHead } from "@/components/marketing/section-head";
import type { Dictionary } from "@/lib/i18n";

/**
 * The same crops, in every script the platform speaks.
 *
 * Worth a whole band because it is the one claim on this page a competitor
 * cannot copy without doing the work. Anybody can write "available in six
 * languages"; showing தக்காளி beside టమాటా beside ಟೊಮ್ಯಾಟೊ is the claim and the
 * evidence at once.
 *
 * It is also the honest picture of the product: crop names are held per
 * language as data, editable by operations, because the same crop genuinely
 * goes by different words across Tamil Nadu.
 *
 * Rendered server-side as plain text. Each cell carries `lang`, so the right
 * font is selected and a screen reader switches voice rather than attempting
 * Tamil in an English one.
 */
export function LanguageBand({ t }: { t: Dictionary }) {
  // A handful of crops with a name in every language — a gap here would read
  // as a missing translation rather than as the point being made.
  const crops = Object.values(CATALOGUE)
    .filter((c) => LOCALES.every((l) => c.names[l]))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <SectionHead
        index="02"
        eyebrow={t.languages.eyebrow}
        title={t.languages.title}
        body={t.languages.body}
        align="center"
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-separate border-spacing-0">
          <caption className="sr-only">{t.languages.caption}</caption>
          <thead>
            <tr>
              {LOCALES.map((locale) => (
                <th
                  key={locale}
                  scope="col"
                  className="border-border text-muted-foreground border-b px-3 pb-3 text-left text-xs font-medium"
                >
                  <span lang={LOCALE_META[locale].tag}>
                    {LOCALE_META[locale].nativeName}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {crops.map((crop) => (
              <tr key={crop.id} className="group">
                {LOCALES.map((locale) => (
                  <td
                    key={locale}
                    lang={LOCALE_META[locale].tag}
                    className="border-border/60 group-hover:bg-secondary/50 border-b px-3 py-3.5 text-lg transition-colors first:font-medium"
                  >
                    {produceName(crop, locale)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
