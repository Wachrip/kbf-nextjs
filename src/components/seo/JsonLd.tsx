import { getAbout } from "@/data/repo";
import { normalizePhone } from "@/lib/format";
import { STATIC } from "@/lib/images";
import { socialUrl } from "@/lib/social";
import { absoluteUrl, FOUNDED_YEAR, SITE_NAME, SITE_URL } from "@/lib/site";

/** Разметка schema.org. «<» экранируется — JSON не закроет тег script. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/** Федерация как SportsOrganization — на всех страницах (layout). */
export async function OrganizationJsonLd() {
  const about = await getAbout();
  const sameAs = [
    about.instagram && socialUrl("instagram", about.instagram),
    about.youtube && socialUrl("youtube", about.youtube),
    about.telegram && socialUrl("telegram", about.telegram),
  ].filter((x): x is string => Boolean(x));
  const phone = normalizePhone(about.phone);
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "SportsOrganization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        alternateName: "КБФ",
        url: SITE_URL,
        // Не белый logo-white.png (невидим на белом фоне в выдаче) — цветной SVG
        logo: absoluteUrl(STATIC.logoColor),
        sport: "Basketball",
        foundingDate: String(FOUNDED_YEAR),
        memberOf: { "@type": "SportsOrganization", name: "FIBA Asia" },
        ...(about.email ? { email: about.email } : {}),
        ...(phone ? { telephone: phone } : {}),
        ...(about.address
          ? {
              address: {
                "@type": "PostalAddress",
                streetAddress: about.address,
                addressLocality: "Бишкек",
                addressCountry: "KG",
              },
            }
          : {}),
        ...(sameAs.length ? { sameAs } : {}),
      }}
    />
  );
}
