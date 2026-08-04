import Link from "next/link";
import { MoneyText } from "@/ui/primitivas/money";
import { cn } from "@/ui/primitivas/cn";
import type { ProvenanceRow } from "./provenance-panel";

export function ProvenanceRowItem({ row }: { row: ProvenanceRow }) {
  const content = (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate text-text">{row.label}</p>
        {row.detail ? <p className="truncate text-xs text-text-muted">{row.detail}</p> : null}
      </div>
      {row.amount != null ? (
        <MoneyText value={row.amount} sign="none" className="shrink-0 text-text" />
      ) : null}
    </div>
  );

  return (
    <li>
      {row.href ? (
        <Link href={row.href} className={cn("block rounded-md hover:bg-bg-surface")}>
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  );
}
