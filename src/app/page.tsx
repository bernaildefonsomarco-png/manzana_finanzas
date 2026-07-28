import { redirect } from "next/navigation";
import { createClient } from "@/data/supabase/server";

// `WEB-D151`: `/` no renderiza nada propio en V1. Sin sesión, a `/entrar`;
// con sesión, a `/inicio`. El proxy ya redirige la mayoría de los casos sin
// sesión (`src/proxy.ts`); esto cubre el caso con sesión, que el proxy deja
// pasar tal cual.
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/inicio" : "/entrar");
}
