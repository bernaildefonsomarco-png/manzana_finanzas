import type { Metadata } from "next";

import {
  ContactBlock,
  InfoCard,
  PublicHero,
  PublicPageShell,
  TrustList,
} from "@/features/public-site/public-site";
import { publicIdentity } from "@/shared/public-identity";

export const metadata: Metadata = {
  title: "Eliminar datos - Manzana",
  description:
    "Instrucciones publicas para solicitar eliminacion de datos en Manzana.",
};

export default function DataDeletionPage() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Eliminacion de datos"
        title="Puedes pedir que eliminemos tus datos."
        description="Esta pagina define el camino publico para solicitar eliminacion de cuenta, movimientos y datos asociados cuando la funcion automatica aun no este disponible dentro de la app."
      />

      <section className="mx-auto grid w-full max-w-6xl gap-5 px-6 pb-14 sm:px-10 lg:px-12">
        <InfoCard title="Como solicitar eliminacion">
          <TrustList
            items={[
              `Escribe a ${publicIdentity.privacyEmail} desde el correo asociado a tu cuenta.`,
              "Incluye el asunto: Solicitud de eliminacion de datos.",
              "Indica si quieres eliminar toda la cuenta o solo datos especificos.",
              "Si usas WhatsApp, incluye el numero asociado para ubicar la cuenta.",
            ]}
          />
        </InfoCard>

        <InfoCard title="Que eliminamos">
          <p>
            Podemos eliminar o anonimizar datos de perfil, preferencias,
            movimientos, pendientes, conversaciones operativas, conexiones y
            trazas asociadas cuando no exista una razon de seguridad, auditoria,
            soporte o cumplimiento para conservarlos temporalmente.
          </p>
        </InfoCard>

        <InfoCard title="Confirmacion">
          <p>
            Antes de eliminar informacion sensible, Manzana puede pedir una
            verificacion razonable para confirmar que la solicitud viene del
            titular de la cuenta.
          </p>
        </InfoCard>

        <ContactBlock />
      </section>
    </PublicPageShell>
  );
}
