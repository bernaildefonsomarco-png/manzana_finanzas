import { MemoryScreen } from "@/features/memory/memory-screen";
import type { MemoryScope } from "@/features/memory/memory-types";

type Props = { searchParams: Promise<{ clase?: string; inactivos?: string }> };

export default async function ConfiguracionMemoriaPage({ searchParams }: Props) {
  const query = await searchParams;
  const scope = ["classification", "profile", "preference"].includes(query.clase ?? "")
    ? (query.clase as MemoryScope)
    : undefined;
  return <MemoryScreen includeInactive={query.inactivos === "1"} scope={scope} />;
}
