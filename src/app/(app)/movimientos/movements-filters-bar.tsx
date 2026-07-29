"use client";

import { Plus, Search, X } from "lucide-react";
import { Button } from "@/ui/primitivas/button";
import { Input, Select } from "@/ui/primitivas/field";
import { MOVEMENT_TYPE_LABEL, MOVEMENT_TYPE_ORDER } from "./movement-form/movement-types";

const MOVEMENT_STATUSES = [
  { value: "", label: "Todos los estados" },
  { value: "confirmed", label: "Confirmado" },
  { value: "needs_review", label: "Por revisar" },
  { value: "corrected", label: "Corregido" },
  { value: "deleted", label: "Eliminado" },
];

/** `AC-MOV-05`: la busqueda siempre esta disponible. `AC-MOV-03`: los
 * filtros se aplican en servidor via `updateFilter`. */
export function MovementsFiltersBar({
  searchInput,
  onSearchInputChange,
  onSubmitSearch,
  typeFilter,
  statusFilter,
  onFilterChange,
  hasActiveFilters,
  onClearFilters,
  onNewMovement,
}: {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSubmitSearch: (event: React.FormEvent) => void;
  typeFilter: string;
  statusFilter: string;
  onFilterChange: (key: string, value: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onNewMovement: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={onSubmitSearch} className="flex min-w-64 flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              value={searchInput}
              onChange={(event) => onSearchInputChange(event.target.value)}
              placeholder="Buscar por comercio o descripción…"
              aria-label="Buscar movimientos"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
        <Button onClick={onNewMovement}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nuevo
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Filtrar por tipo"
          value={typeFilter}
          onChange={(event) => onFilterChange("tipo", event.target.value)}
          className="h-9 w-auto text-xs"
        >
          <option value="">Todos los tipos</option>
          {MOVEMENT_TYPE_ORDER.map((type) => (
            <option key={type} value={type}>
              {MOVEMENT_TYPE_LABEL[type]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrar por estado"
          value={statusFilter}
          onChange={(event) => onFilterChange("estado", event.target.value)}
          className="h-9 w-auto text-xs"
        >
          {MOVEMENT_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </Select>
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            <X className="h-3 w-3" aria-hidden="true" />
            Limpiar filtros
          </Button>
        ) : null}
      </div>
    </>
  );
}
