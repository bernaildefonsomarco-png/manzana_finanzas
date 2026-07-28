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
  title: "Terminos - Manzana",
  description:
    "Terminos publicos de uso de Manzana para finanzas personales por WhatsApp y dashboard.",
};

export default function TermsPage() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Terminos de uso"
        title="Manzana te ayuda a ordenar, no decide por ti."
        description={`Estos terminos describen el uso esperado de ${publicIdentity.brandName}. Fecha de vigencia: ${publicIdentity.policyEffectiveDate}.`}
      />

      <section className="mx-auto grid w-full max-w-6xl gap-5 px-6 pb-14 sm:px-10 lg:px-12">
        <InfoCard title="Servicio">
          <p>
            Manzana es una herramienta de finanzas personales que permite
            registrar, revisar y entender movimientos desde WhatsApp y dashboard.
            El servicio esta orientado a claridad financiera personal, no a
            contabilidad empresarial, asesoria financiera regulada ni decision de
            inversion.
          </p>
        </InfoCard>

        <InfoCard title="Uso responsable">
          <TrustList
            items={[
              "El usuario debe revisar y confirmar la informacion importante antes de usarla para tomar decisiones.",
              "Manzana puede equivocarse al interpretar mensajes ambiguos; por eso existen pendientes, correcciones y origen visible.",
              "Nada detectado automaticamente debe considerarse definitivo hasta que el usuario lo confirme.",
              "El usuario no debe usar Manzana para actividades ilegales, fraude, abuso de plataformas o suplantacion.",
            ]}
          />
        </InfoCard>

        <InfoCard title="No es asesoria financiera">
          <p>
            Las respuestas, insights y sugerencias de Manzana son informativas.
            No constituyen asesoria financiera, legal, tributaria, contable o de
            inversion. El usuario conserva la responsabilidad final sobre sus
            decisiones.
          </p>
        </InfoCard>

        <InfoCard title="WhatsApp y proveedores externos">
          <p>
            Cuando el usuario usa WhatsApp, tambien aplican los terminos y
            politicas de WhatsApp y Meta. Manzana no controla la plataforma de
            WhatsApp, sus notificaciones, disponibilidad, costos, restricciones
            de ventana de conversacion o revision de nombres comerciales.
          </p>
        </InfoCard>

        <InfoCard title="Suspension o cambios">
          <p>
            Manzana puede cambiar, pausar o limitar funciones por seguridad,
            abuso, mantenimiento, restricciones de proveedores o decisiones de
            producto. Cualquier cambio relevante deberia comunicarse con claridad
            cuando afecte el uso normal.
          </p>
        </InfoCard>

        <ContactBlock />
      </section>
    </PublicPageShell>
  );
}
