import { MemoryDetailScreen } from "@/features/memory/memory-screen";

export default async function ConfiguracionMemoriaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  return <MemoryDetailScreen id={(await params).id} />;
}
