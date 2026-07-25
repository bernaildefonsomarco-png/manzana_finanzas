import type { Metadata } from "next";

import {
  ContactBlock,
  InfoCard,
  PublicHero,
  PublicPageShell,
} from "@/features/public-site/public-site";
import { publicIdentity } from "@/shared/public-identity";

export const metadata: Metadata = {
  title: "Contacto - Manzana",
  description:
    "Contacto publico de Manzana para soporte, privacidad y verificacion.",
};

export default function ContactPage() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Contacto"
        title="Un canal claro para soporte, privacidad y verificacion."
        description="Esta pagina concentra la informacion publica que un usuario, proveedor o revisor puede usar para contactar a Manzana."
      />

      <section className="mx-auto grid w-full max-w-6xl gap-5 px-6 pb-14 sm:px-10 lg:px-12">
        <ContactBlock />

        <InfoCard title="Informacion publica">
          <p>Operador legal: {publicIdentity.legalOperator}</p>
          <p>Estado legal: {publicIdentity.legalStatus}</p>
          <p>Pais: {publicIdentity.country}</p>
          <p>Direccion publica: {publicIdentity.publicAddress}</p>
          <p>Sitio web: {publicIdentity.websiteUrl}</p>
        </InfoCard>

        <InfoCard title="Uso del contacto">
          <p>
            Usa soporte para problemas con tu cuenta o movimientos. Usa
            privacidad para solicitudes sobre datos personales, eliminacion,
            acceso o correccion de informacion.
          </p>
        </InfoCard>
      </section>
    </PublicPageShell>
  );
}
