type HistoryEntry = {
  id: string;
  action: string;
  field_name: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
};

/** `ACT-MOV-08`/`AC-MOV-07`: historial de cambios de un movimiento. */
export function MovementHistoryList({ entries, loading }: { entries?: HistoryEntry[]; loading: boolean }) {
  if (loading) return <p className="mt-4 text-sm text-text-muted">Cargando historial…</p>;
  if (!entries || entries.length === 0) {
    return <p className="mt-4 text-sm text-text-muted">Sin cambios registrados todavía.</p>;
  }
  return (
    <ul className="mt-4 space-y-2 border-t border-border pt-4">
      {entries.map((entry) => (
        <li key={entry.id} className="text-sm text-text-secondary">
          <span className="font-medium text-text">{historyActionLabel(entry.action)}</span>
          {" · "}
          {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" }).format(
            new Date(entry.created_at),
          )}
          {entry.field_name ? ` · ${entry.field_name}` : ""}
        </li>
      ))}
    </ul>
  );
}

function historyActionLabel(action: string): string {
  switch (action) {
    case "created":
      return "Creado";
    case "updated":
    case "corrected":
      return "Editado";
    case "deleted":
      return "Eliminado";
    case "restored":
      return "Restaurado";
    case "reversed":
      return "Revertido";
    default:
      return action;
  }
}
