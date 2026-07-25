import { getAgentRuntimeReadiness } from "@/agents/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = getAgentRuntimeReadiness();
  return Response.json(report, {
    status: report.overall_ready ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
