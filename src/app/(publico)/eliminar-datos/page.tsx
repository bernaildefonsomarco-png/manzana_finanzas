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
    "Como eliminar tu cuenta y tus datos en Manzana, desde la aplicacion.",
};

// `45` `RUL-CONF-08`/`SCR-CONF-08` — cierra `C-14`: el borrado automatico
// ya existe (`DELETE /api/v1/privacy/account`, con pantalla real en
// `DeleteAccountSection`), así que esta página deja de decir que "puede no
// estar disponible dentro de la app". La vía por correo pasa a ser la
// alternativa, no la principal.
export default function DataDeletionPage() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Eliminacion de datos"
        title="Puedes eliminar tu cuenta y todos tus datos desde la aplicacion, sin pedirselo a nadie."
        description={`Version ${publicIdentity.policyVersion}, vigente desde el ${publicIdentity.policyEffectiveDate}.`}
      />

      <section className="mx-auto grid w-full max-w-6xl gap-5 px-6 pb-14 sm:px-10 lg:px-12">
        <InfoCard title="Como eliminar tu cuenta">
          <TrustList
            items={[
              "Entra en Manzana.",
              "Ve a Configuracion → Tus datos.",
              "Descarga tus datos si quieres conservarlos.",
              'Pulsa "Eliminar mi cuenta", escribe la frase de confirmacion y confirma.',
            ]}
          />
        </InfoCard>

        <InfoCard title="Que pasa al eliminar">
          <p>
            Se elimina todo de inmediato y no se puede deshacer: movimientos,
            cuentas, deudas, lo que Manzana aprendio sobre ti y tus
            conversaciones. Si tenias un correo conectado, tambien revocamos el
            permiso con Google. No hay periodo de gracia: la eliminacion es
            irreversible desde el momento en que la confirmas.
          </p>
        </InfoCard>

        <InfoCard title="Si no puedes entrar a tu cuenta">
          <p>
            Esta es la alternativa, no la via principal: escribenos a{" "}
            {publicIdentity.privacyEmail} y lo hacemos nosotros. Te pediremos
            confirmar que la direccion es tuya antes de eliminar nada.
          </p>
        </InfoCard>

        <ContactBlock />
      </section>
    </PublicPageShell>
  );
}
