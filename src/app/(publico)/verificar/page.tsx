import { VerifyEmailScreen } from "@/features/auth/verify-email-screen";

export default async function VerificarPage({
  searchParams,
}: {
  searchParams: Promise<{ correo?: string }>;
}) {
  const { correo } = await searchParams;
  return <VerifyEmailScreen initialEmail={correo ?? ""} />;
}
