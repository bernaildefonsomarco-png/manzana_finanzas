import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { useZodForm } from "./use-zod-form";

// Caso difícil de `WEB-D165` / `AC-PAT-10`: el patrón "esquema base + esquema
// por tipo" de `17` §5.2, con un ejemplo genérico de dos tipos — no el
// formulario real de movimiento (once tipos), que es trabajo de `W-09`
// (`RUL-HECHO-04`). Lo que se prueba aquí es el PATRÓN de composición, no el
// contenido del formulario de movimiento.
const baseSchema = z.object({
  tipo: z.enum(["gasto", "prestamo"]),
  monto: z.string().min(1, "El monto es obligatorio"),
  descripcion: z.string().min(1, "La descripción es obligatoria"),
});

const gastoSchema = baseSchema.extend({
  tipo: z.literal("gasto"),
  cuentaId: z.string().min(1, "Elige una cuenta"),
});

const prestamoSchema = baseSchema.extend({
  tipo: z.literal("prestamo"),
  personaNombre: z.string().min(1, "El nombre de la persona es obligatorio"),
});

// "Tabla de configuración por tipo", no una cadena de condicionales dentro
// del componente (`17` §5.2).
const composedSchema = z.discriminatedUnion("tipo", [gastoSchema, prestamoSchema]);

type FormValues = {
  tipo: "gasto" | "prestamo";
  monto: string;
  descripcion: string;
  cuentaId?: string;
  personaNombre?: string;
};

function FormularioDeMovimientoGenerico({
  tipo,
  onSubmitted,
}: {
  tipo: "gasto" | "prestamo";
  onSubmitted: (values: FormValues) => void;
}) {
  const form = useZodForm(composedSchema as unknown as z.ZodType<FormValues>, {
    defaultValues: { tipo, monto: "", descripcion: "", cuentaId: "", personaNombre: "" },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmitted)}>
      <input type="hidden" value={tipo} {...form.register("tipo")} />
      <label>
        Monto
        <input aria-label="Monto" {...form.register("monto")} />
      </label>
      {form.formState.errors.monto && <p>{form.formState.errors.monto.message}</p>}

      <label>
        Descripción
        <input aria-label="Descripción" {...form.register("descripcion")} />
      </label>
      {form.formState.errors.descripcion && <p>{form.formState.errors.descripcion.message}</p>}

      {tipo === "gasto" && (
        <label>
          Cuenta
          <input aria-label="Cuenta" {...form.register("cuentaId")} />
        </label>
      )}
      {tipo === "prestamo" && (
        <label>
          Persona
          <input aria-label="Persona" {...form.register("personaNombre")} />
        </label>
      )}
      {(form.formState.errors as Record<string, { message?: string }>).cuentaId && (
        <p>{(form.formState.errors as Record<string, { message?: string }>).cuentaId?.message}</p>
      )}
      {(form.formState.errors as Record<string, { message?: string }>).personaNombre && (
        <p>{(form.formState.errors as Record<string, { message?: string }>).personaNombre?.message}</p>
      )}

      <button type="submit">Guardar</button>
    </form>
  );
}

describe("useZodForm — patrón base + por tipo (17 §5.2, AC-PAT-07)", () => {
  it("un envío que falla conserva todos los valores escritos", async () => {
    render(<FormularioDeMovimientoGenerico tipo="gasto" onSubmitted={() => {}} />);

    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "15.50" } });
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Taxi al trabajo" } });
    // Cuenta se deja vacía a propósito: el envío debe fallar.
    fireEvent.click(screen.getByText("Guardar"));

    expect(await screen.findByText("Elige una cuenta")).toBeInTheDocument();
    // AC-PAT-07: lo escrito sigue ahí, el formulario no se vació al fallar.
    expect(screen.getByLabelText("Monto")).toHaveValue("15.50");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Taxi al trabajo");
  });

  it("el foco va al primer campo con error tras un envío fallido (17 §5.1 regla 7)", async () => {
    render(<FormularioDeMovimientoGenerico tipo="gasto" onSubmitted={() => {}} />);

    fireEvent.click(screen.getByText("Guardar"));

    await screen.findByText("El monto es obligatorio");
    expect(document.activeElement).toBe(screen.getByLabelText("Monto"));
  });

  it("cambiar de tipo conserva los campos base ya escritos y muestra los campos del nuevo tipo", () => {
    const { rerender } = render(
      <FormularioDeMovimientoGenerico tipo="gasto" onSubmitted={() => {}} />
    );

    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Le di 50 a Luis" } });
    expect(screen.getByLabelText("Cuenta")).toBeInTheDocument();

    rerender(<FormularioDeMovimientoGenerico tipo="prestamo" onSubmitted={() => {}} />);

    // El campo de "Cuenta" del tipo anterior desaparece y aparece "Persona"...
    expect(screen.queryByLabelText("Cuenta")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Persona")).toBeInTheDocument();
    // ...pero los campos base (monto, descripción) NO se perdieron al cambiar de tipo.
    expect(screen.getByLabelText("Monto")).toHaveValue("50");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Le di 50 a Luis");
  });

  it("un envío válido llega al callback con los datos del tipo correcto", async () => {
    let submitted: FormValues | null = null;
    render(
      <FormularioDeMovimientoGenerico
        tipo="prestamo"
        onSubmitted={(values) => {
          submitted = values;
        }}
      />
    );

    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Préstamo a Luis" } });
    fireEvent.change(screen.getByLabelText("Persona"), { target: { value: "Luis" } });
    fireEvent.click(screen.getByText("Guardar"));

    await waitFor(() => expect(submitted).not.toBeNull());
    // El resolver de Zod descarta `cuentaId` porque la rama "prestamo" del
    // `discriminatedUnion` no lo declara: el efectivo compuesto de `17` §5.2
    // solo conserva los campos del tipo elegido.
    expect(submitted).toEqual({
      tipo: "prestamo",
      monto: "50",
      descripcion: "Préstamo a Luis",
      personaNombre: "Luis",
    });
  });
});
