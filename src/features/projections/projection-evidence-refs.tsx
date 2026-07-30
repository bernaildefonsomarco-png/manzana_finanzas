"use client";

import Link from "next/link";

export function ProjectionEvidenceRefs({
  refs,
  hrefByRef,
}: {
  refs: string[];
  hrefByRef: Map<string, string>;
}) {
  if (refs.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap justify-end gap-2 text-xs">
      {refs.map((ref) => {
        const href = hrefByRef.get(ref);
        return (
          <li key={ref}>
            {href ? (
              <Link
                href={href}
                className="rounded-sm text-brand underline decoration-brand/40 underline-offset-2 hover:text-brand-hover"
              >
                <code>{ref}</code>
              </Link>
            ) : (
              <code className="text-text-muted">{ref}</code>
            )}
          </li>
        );
      })}
    </ul>
  );
}
