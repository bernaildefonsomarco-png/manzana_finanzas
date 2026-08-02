import { setMuted } from "../mute/route";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ type: string }> };

export async function POST(request: Request, context: RouteContext) {
  return setMuted(request, context, false);
}
