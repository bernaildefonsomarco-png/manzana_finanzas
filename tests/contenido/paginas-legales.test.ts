import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// `45` `RUL-CONF-09` punto 3 / `AC-CONF-10` — un test comprueba las
// afirmaciones comprobables de las páginas legales contra el
// comportamiento real y falla el build si divergen. Clase `contenido`
// (`51` §6, `tests/contenido/`). Lee el código fuente de la página en vez
// de HTML renderizado: no hay servidor levantado en esta suite, y el texto
// vive completo en el JSX — leerlo de ahí es tan real como leerlo del HTML
// servido, porque no hay transformación de contenido entre los dos.

function paginaFuente(ruta: string): string {
  return readFileSync(join(process.cwd(), "src", "app", "(publico)", ruta, "page.tsx"), "utf8");
}

function todasLasMigraciones(): string {
  const dir = join(process.cwd(), "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
}

describe("AC-CONF-08: /privacidad contiene la declaración Limited Use de Google (cierra C-16)", () => {
  const fuente = paginaFuente("privacidad");

  it("menciona 'Limited Use' y 'Google API Services User Data Policy'", () => {
    expect(fuente).toContain("Limited Use");
    expect(fuente).toContain("Google API Services User Data Policy");
  });

  it("declara que no se guarda el cuerpo de los correos, y el esquema lo confirma (RUL-CONF-09.3)", () => {
    expect(fuente.toLowerCase()).toContain("nunca guardamos el cuerpo completo");
    // Invariante real del esquema: cada mensaje procesado se marca
    // explícitamente `content_persisted: false` (28 §4.4).
    expect(todasLasMigraciones()).toContain("'content_persisted', false");
  });

  it("declara que no se venden ni ceden datos, y que no se entrenan modelos con ellos", () => {
    expect(fuente.toLowerCase()).toContain("no vendemos ni cedemos");
    expect(fuente.toLowerCase()).toContain("no entrenamos modelos");
  });

  it("dice cómo eliminar la cuenta, y que se puede desde la aplicación (cierra C-14 también aquí)", () => {
    expect(fuente).toMatch(/desde la\s*\n?\s*aplicacion/i);
  });

  it("lleva versión y fecha de vigencia (RUL-CONF-09.1)", () => {
    expect(fuente).toContain("policyVersion");
    expect(fuente).toContain("policyEffectiveDate");
  });
});

describe("AC-CONF-09: /eliminar-datos describe el flujo en la aplicación como vía principal (cierra C-14)", () => {
  const fuente = paginaFuente("eliminar-datos");

  it("RUL-HECHO-02: ya no dice que el borrado 'puede no estar disponible dentro de la app'", () => {
    expect(fuente.toLowerCase()).not.toContain("no este disponible dentro de la app");
    expect(fuente.toLowerCase()).not.toContain("no esté disponible dentro de la app");
  });

  it("el flujo en la aplicación aparece antes que la vía por correo", () => {
    const indiceFlujoApp = fuente.indexOf("Configuracion");
    const indiceCorreo = fuente.indexOf("Si no puedes entrar");
    expect(indiceFlujoApp).toBeGreaterThan(-1);
    expect(indiceCorreo).toBeGreaterThan(indiceFlujoApp);
  });

  it("la vía por correo se declara explícitamente como alternativa, no principal", () => {
    expect(fuente).toContain("la alternativa, no la via principal");
  });

  it("la ruta real DELETE /api/v1/privacy/account existe (lo que hace verdadera la afirmación de arriba)", () => {
    const routeSource = readFileSync(
      join(process.cwd(), "src", "app", "api", "v1", "privacy", "account", "route.ts"),
      "utf8",
    );
    expect(routeSource).toContain("export async function DELETE");
  });
});
