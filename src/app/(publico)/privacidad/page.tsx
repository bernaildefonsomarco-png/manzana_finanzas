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
  title: "Privacidad - Manzana",
  description:
    "Politica de privacidad publica de Manzana para datos financieros personales, WhatsApp, dashboard y confirmaciones.",
};

export default function PrivacyPage() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Privacidad"
        title="Tus datos financieros deben estar bajo tu control."
        description={`Esta politica explica como ${publicIdentity.brandName} maneja datos personales y financieros durante la V1. Fecha de vigencia: ${publicIdentity.policyEffectiveDate}.`}
      />

      <section className="mx-auto grid w-full max-w-6xl gap-5 px-6 pb-14 sm:px-10 lg:px-12">
        <InfoCard title="Datos que podemos tratar">
          <p>
            Manzana puede tratar datos que el usuario envia o confirma: mensajes
            de WhatsApp, movimientos financieros, categorias, cuentas, cajas,
            deudas, pagos que vienen, pendientes, correcciones y preferencias de
            privacidad.
          </p>
          <p>
            Cuando se conecten integraciones como email, los datos detectados no
            se registraran como movimientos hasta que el usuario los confirme.
          </p>
        </InfoCard>

        <InfoCard title="Para que usamos los datos">
          <TrustList
            items={[
              "Registrar y corregir movimientos confirmados por el usuario.",
              "Mostrar saldos, dinero libre, deudas, pagos que vienen y pendientes.",
              "Responder preguntas financieras con herramientas de solo lectura.",
              "Detectar duplicados, riesgos, recurrentes e insights utiles.",
              "Mejorar la experiencia sin vender datos personales.",
            ]}
          />
        </InfoCard>

        <InfoCard title="Reglas de proteccion">
          <p>
            Los agentes de IA no escriben directamente dinero ni modifican
            saldos. Toda escritura financiera debe pasar por el Core financiero y
            por reglas deterministicas.
          </p>
          <p>
            Los pendientes detectados desde email, automatizaciones o fuentes
            ambiguas no afectan saldo, cajas, deudas o reportes hasta que el
            usuario los apruebe.
          </p>
          <p>
            El usuario puede corregir, descartar o pedir explicacion del origen
            de un dato. Tambien puede activar modo discreto cuando necesite mayor
            privacidad visual o conversacional.
          </p>
        </InfoCard>

        <InfoCard title="Proveedores tecnicos">
          <p>
            Manzana puede usar proveedores de infraestructura, autenticacion,
            base de datos, mensajeria, email y observabilidad para operar el
            servicio. La arquitectura V1 esta preparada para Supabase,
            PostgreSQL, Vercel, Kapso/WhatsApp Business Platform y
            Google/Gmail cuando las integraciones esten habilitadas.
          </p>
          <p>
            El uso de WhatsApp esta sujeto a las politicas y condiciones de Meta
            y WhatsApp. El usuario tambien conserva su relacion directa con
            WhatsApp como plataforma de mensajeria.
          </p>
        </InfoCard>

        <InfoCard title="Conservacion y eliminacion">
          <p>
            Conservamos datos mientras la cuenta este activa o mientras sean
            necesarios para auditoria, seguridad, soporte, cumplimiento o
            continuidad del servicio.
          </p>
          <p>
            El usuario puede solicitar eliminacion desde la pagina de eliminacion
            de datos o escribiendo al contacto de privacidad.
          </p>
        </InfoCard>

        <ContactBlock />
      </section>
    </PublicPageShell>
  );
}
