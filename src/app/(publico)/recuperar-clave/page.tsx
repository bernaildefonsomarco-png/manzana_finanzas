import { RecoverPasswordScreen } from "@/features/auth/recover-password-screen";

export default async function RecuperarClavePage({
  searchParams,
}: {
  searchParams: Promise<{ correo?: string }>;
}) {
  const { correo } = await searchParams;
  return <RecoverPasswordScreen initialEmail={correo ?? ""} />;
}
