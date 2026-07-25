import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { createClient as createCookieClient } from "@/data/supabase/server";
import type { Database } from "@/data/supabase/types";

export type ApiAuth = {
  userId: string;
  client: SupabaseClient<Database>;
};

export async function getApiAuth(request: Request): Promise<ApiAuth | null> {
  const authorization = request.headers.get("authorization");

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const client = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      }
    );

    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;

    return { userId: data.user.id, client };
  }

  const client = await createCookieClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;

  return { userId: data.user.id, client };
}

