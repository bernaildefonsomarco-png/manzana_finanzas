import { Archive, Pencil } from "lucide-react";
import { Button } from "@/ui/primitivas/button";
import type { SubcategoryWithCount } from "@/shared/api/categories-types";

export function SubcategoryRow({
  subcategory,
  onRename,
  onArchive,
}: {
  subcategory: SubcategoryWithCount;
  onRename: () => void;
  onArchive: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-text">{subcategory.label}</p>
        <p className="text-xs text-text-muted">
          {subcategory.movement_count} movimiento{subcategory.movement_count === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          title={`Renombrar ${subcategory.label}`}
          aria-label={`Renombrar ${subcategory.label}`}
          onClick={onRename}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title={`Archivar ${subcategory.label}`}
          aria-label={`Archivar ${subcategory.label}`}
          onClick={onArchive}
        >
          <Archive className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
