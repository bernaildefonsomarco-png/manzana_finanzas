import { ContactBlock, InfoCard, PublicHero, PublicPageShell } from "@/features/public-site/public-site";

// `48` `SCR-AYUDA-06`/`RUL-AYUDA-10` — pública, sin sesión, legible sin
// JavaScript (`AC-AYUDA-11`): página estática de servidor, sin cliente. En
// V1 se actualiza a mano — es aceptable, dice cuándo se actualizó y no
// promete tiempo real (`48` §6).
const LAST_UPDATED = "3 de agosto de 2026, 02:00 (America/Lima)";

const COMPONENTS: { name: string; status: "operativo" | "con_incidencia" }[] = [
  { name: "Iniciar sesión y registro", status: "operativo" },
  { name: "Registrar y consultar movimientos", status: "operativo" },
  { name: "Detección por correo", status: "operativo" },
  { name: "Asistente conversacional", status: "operativo" },
  { name: "Correo saliente (recordatorios y avisos)", status: "operativo" },
];

export default function EstadoPage() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Estado"
        title="Estado del producto"
        description={`Actualizado a mano, no en tiempo real. Última actualización: ${LAST_UPDATED}.`}
      />
      <section className="mx-auto grid w-full max-w-6xl gap-5 px-6 pb-14 sm:px-10 lg:px-12">
        <InfoCard title="Componentes">
          <ul className="divide-y divide-border">
            {COMPONENTS.map((component) => (
              <li key={component.name} className="flex items-center justify-between py-3 text-sm">
                <span>{component.name}</span>
                <span className={component.status === "operativo" ? "text-success" : "text-error"}>
                  {component.status === "operativo" ? "Operativo" : "Con incidencia"}
                </span>
              </li>
            ))}
          </ul>
        </InfoCard>
        <ContactBlock />
      </section>
    </PublicPageShell>
  );
}
