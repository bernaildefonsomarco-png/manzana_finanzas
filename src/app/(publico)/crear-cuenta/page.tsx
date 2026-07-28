import { AuthScreen } from "@/features/auth/auth-screen";

export default async function CrearCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ redirigir?: string }>;
}) {
  const { redirigir } = await searchParams;
  return <AuthScreen initialMode="signup" redirectTo={redirigir} />;
}
