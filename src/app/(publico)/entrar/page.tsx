import { AuthScreen } from "@/features/auth/auth-screen";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ redirigir?: string }>;
}) {
  const { redirigir } = await searchParams;
  return <AuthScreen initialMode="login" redirectTo={redirigir} />;
}
