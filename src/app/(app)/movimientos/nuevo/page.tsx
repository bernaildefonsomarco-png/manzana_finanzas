import { MovementsListScreen } from "../movements-list-screen";

// Ruta con URL propia (`10` §4): en escritorio se presenta como modal sobre
// el listado; tener URL permite enlazarla desde el Inicio, un recordatorio o
// el asistente.
export default function MovimientoNuevoPage() {
  return <MovementsListScreen openNewOnMount />;
}
