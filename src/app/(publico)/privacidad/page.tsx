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

// `45` `RUL-CONF-08`/`RUL-CONF-09` — cierra `C-16` (Limited Use ausente) y
// media `C-14` (ver también `/eliminar-datos`). Cada afirmación de esta
// página es una de las que `AC-CONF-10` puede verificar contra el
// comportamiento real (`tests/contenido/`, clase `contenido`).
export default function PrivacyPage() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Privacidad"
        title="Tus datos financieros deben estar bajo tu control."
        description={`Esta politica explica como ${publicIdentity.brandName} maneja datos personales y financieros. Version ${publicIdentity.policyVersion}, vigente desde el ${publicIdentity.policyEffectiveDate}.`}
      />

      <section className="mx-auto grid w-full max-w-6xl gap-5 px-6 pb-14 sm:px-10 lg:px-12">
        <InfoCard title="Que datos recogemos, por categoria">
          <TrustList
            items={[
              "Cuenta: correo, contraseña cifrada por el proveedor de autenticacion, nombre.",
              "Financieros: movimientos, cuentas, cajas, deudas, presupuestos, categorias y las correcciones que hagas.",
              "Correo conectado (si lo autorizas): solo los remitentes de bancos que tu elijas, nunca el resto de tu bandeja.",
              "Conversaciones con el asistente y las confirmaciones que le das.",
              "Preferencias: modo discreto, categorias que marcas como discretas, recordatorios.",
            ]}
          />
        </InfoCard>

        <InfoCard title="Uso limitado de tu correo de Google (Limited Use)">
          <p>
            Cuando conectas un buzon de Gmail, Manzana usa y transfiere la
            informacion que recibe de las APIs de Google conforme a la
            {" "}
            <strong>Google API Services User Data Policy</strong>, incluidos sus
            requisitos de <strong>Limited Use</strong>.
          </p>
          <p>
            En la practica: solo leemos los correos de los remitentes de banco
            que tu autorizas explicitamente, nunca guardamos el cuerpo completo
            del correo, nunca registramos un movimiento sin tu confirmacion, y
            nunca usamos ese contenido para publicidad ni lo compartimos con
            terceros.
          </p>
        </InfoCard>

        <InfoCard title="Para que usamos los datos">
          <TrustList
            items={[
              "Registrar y corregir movimientos que tu confirmas.",
              "Mostrar saldos, dinero libre, deudas, pagos que vienen y pendientes.",
              "Responder preguntas financieras con herramientas de solo lectura.",
              "Detectar duplicados, riesgos, recurrentes y descubrimientos utiles.",
              "Mejorar la experiencia sin vender datos personales.",
            ]}
          />
        </InfoCard>

        <InfoCard title="Lo que no hacemos">
          <TrustList
            items={[
              "No vendemos ni cedemos tus datos financieros a terceros.",
              "No entrenamos modelos de inteligencia artificial con tus datos.",
              "No guardamos el cuerpo de los correos que leemos para detectar movimientos.",
              "No hay publicidad, segmentacion ni perfilado con esos fines.",
            ]}
          />
        </InfoCard>

        <InfoCard title="Reglas de proteccion">
          <p>
            Los agentes de IA no escriben directamente dinero ni modifican
            saldos. Toda escritura financiera pasa por el Core financiero y por
            reglas deterministicas, con tu confirmacion antes de tocar un saldo.
          </p>
          <p>
            Los pendientes detectados desde correo o el asistente no afectan
            saldo, cajas, deudas ni reportes hasta que tu los apruebas.
          </p>
          <p>
            Puedes corregir, descartar o pedir explicacion del origen de un
            dato, y activar el modo discreto para ocultar montos en pantalla.
          </p>
        </InfoCard>

        <InfoCard title="Como exportar tus datos">
          <p>
            Desde Configuracion → Tus datos puedes descargar tus movimientos en
            CSV o una exportacion completa con todo lo que Manzana sabe de ti,
            en un formato que otros programas entienden.
          </p>
        </InfoCard>

        <InfoCard title="Como eliminar tu cuenta">
          <p>
            Puedes eliminar tu cuenta y todos tus datos <strong>desde la
            aplicacion</strong>, en Configuracion → Tus datos → Eliminar mi
            cuenta, sin pedirselo a nadie. Ver el detalle en{" "}
            <a href="/eliminar-datos" className="underline">
              /eliminar-datos
            </a>
            .
          </p>
        </InfoCard>

        <InfoCard title="Conservacion y eliminacion">
          <p>
            Conservamos tus datos mientras la cuenta este activa. Al eliminarla,
            el borrado es inmediato: no hay periodo de gracia. Se conserva
            unicamente un registro anonimizado de que la cuenta se elimino, sin
            tu identidad asociada, para poder confirmar la eliminacion si alguna
            vez hace falta.
          </p>
        </InfoCard>

        <ContactBlock />
      </section>
    </PublicPageShell>
  );
}
