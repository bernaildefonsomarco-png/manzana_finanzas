import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { useOptimisticMutation } from "./optimistic-mutation";

function withClient(children: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return { queryClient, ui: <QueryClientProvider client={queryClient}>{children}</QueryClientProvider> };
}

// `AC-EXP-06`: ningún texto afirma que algo se registró antes de que el Core
// lo confirme.
function GuardaMovimiento({ resolveAfter }: { resolveAfter: Promise<void> }) {
  const mutation = useOptimisticMutation<void, { id: string }>({
    mutation: "movement.create",
    mutationFn: async () => {
      await resolveAfter;
      return { id: "mov-1" };
    },
  });

  return (
    <div>
      <button onClick={() => mutation.mutate()}>Guardar</button>
      {mutation.isPending && <p>Guardando…</p>}
      {mutation.isSuccess && <p>Registrado.</p>}
    </div>
  );
}

describe("useOptimisticMutation — AC-EXP-06: nunca 'Registrado' antes de que el Core confirme", () => {
  it("muestra 'Guardando…' mientras la petición está en vuelo, y 'Registrado' solo tras resolver", async () => {
    let resolveMutation: () => void = () => {};
    const resolveAfter = new Promise<void>((resolve) => {
      resolveMutation = resolve;
    });
    const { ui } = withClient(<GuardaMovimiento resolveAfter={resolveAfter} />);
    render(ui);

    screen.getByText("Guardar").click();

    await waitFor(() => expect(screen.getByText("Guardando…")).toBeInTheDocument());
    expect(screen.queryByText("Registrado.")).not.toBeInTheDocument();

    await act(async () => {
      resolveMutation();
      await resolveAfter;
    });

    await waitFor(() => expect(screen.getByText("Registrado.")).toBeInTheDocument());
  });
});

// `AC-CONFIANZA-06`: ante un fallo transitorio, nunca una pantalla vacía si
// existían datos previos (`11` §10).
function ListaConDatos({ fallarSegundaCarga }: { fallarSegundaCarga: () => boolean }) {
  const query = useQuery({
    queryKey: ["movimientos-de-prueba"],
    queryFn: async () => {
      if (fallarSegundaCarga()) throw new Error("Falla de red transitoria");
      return ["taxi 15", "almuerzo 20"];
    },
  });

  if (query.isLoading) return <p>Cargando…</p>;
  if (!query.data) return <p>No hay datos.</p>;

  return (
    <div>
      <ul>
        {query.data.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {query.isError && <p role="alert">No pude actualizar. Tus datos siguen guardados.</p>}
    </div>
  );
}

describe("useQuery — AC-CONFIANZA-06: nunca pantalla vacía si había datos previos", () => {
  it("conserva el listado anterior visible cuando un refetch posterior falla", async () => {
    let calls = 0;
    const fallarSegundaCarga = () => {
      calls += 1;
      return calls >= 2;
    };
    const { queryClient, ui } = withClient(
      <ListaConDatos fallarSegundaCarga={fallarSegundaCarga} />
    );
    render(ui);

    await waitFor(() => expect(screen.getByText("taxi 15")).toBeInTheDocument());

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["movimientos-de-prueba"] });
    });

    // El listado sigue en pantalla pese al fallo: nunca "No hay datos.".
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText("taxi 15")).toBeInTheDocument();
    expect(screen.queryByText("No hay datos.")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Tus datos siguen guardados");
  });
});
