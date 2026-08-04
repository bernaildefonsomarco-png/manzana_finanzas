const DEFAULT_PUBLIC_URL = "https://manzana.website";

function fromEnv(keys: string[], fallback: string) {
  for (const key of keys) {
    const value = process.env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return fallback;
}

export const publicIdentity = {
  brandName: "Manzana",
  productDescription:
    "Finanzas personales por WhatsApp y dashboard, con confirmacion humana antes de tocar saldos.",
  legalOperator: fromEnv(
    ["NEXT_PUBLIC_MANZANA_LEGAL_OPERATOR", "MANZANA_LEGAL_OPERATOR"],
    "Operador legal pendiente de configurar"
  ),
  legalStatus: fromEnv(
    ["NEXT_PUBLIC_MANZANA_LEGAL_STATUS", "MANZANA_LEGAL_STATUS"],
    "Proyecto digital en preparacion para V1"
  ),
  country: fromEnv(
    ["NEXT_PUBLIC_MANZANA_LEGAL_COUNTRY", "MANZANA_LEGAL_COUNTRY"],
    "Peru"
  ),
  publicAddress: fromEnv(
    ["NEXT_PUBLIC_MANZANA_PUBLIC_ADDRESS", "MANZANA_PUBLIC_ADDRESS"],
    "Direccion publica pendiente de configurar"
  ),
  contactEmail: fromEnv(
    ["NEXT_PUBLIC_MANZANA_CONTACT_EMAIL", "MANZANA_CONTACT_EMAIL"],
    "contacto pendiente de configurar"
  ),
  supportEmail: fromEnv(
    ["NEXT_PUBLIC_MANZANA_SUPPORT_EMAIL", "MANZANA_SUPPORT_EMAIL"],
    "soporte pendiente de configurar"
  ),
  privacyEmail: fromEnv(
    ["NEXT_PUBLIC_MANZANA_PRIVACY_EMAIL", "MANZANA_PRIVACY_EMAIL"],
    "privacidad pendiente de configurar"
  ),
  contactPhone: fromEnv(
    ["NEXT_PUBLIC_MANZANA_CONTACT_PHONE", "MANZANA_CONTACT_PHONE"],
    "Telefono publico pendiente de configurar"
  ),
  websiteUrl: fromEnv(
    [
      "NEXT_PUBLIC_MANZANA_APP_URL",
      "MANZANA_APP_URL",
      "NEXT_PUBLIC_MANZANA_WEBSITE_URL",
      "MANZANA_WEBSITE_URL",
    ],
    DEFAULT_PUBLIC_URL
  ),
  // `45` `RUL-CONF-09`: las páginas legales llevan versión y fecha. Se
  // actualiza al revisar el contenido, no en cada despliegue — `W-18`
  // corrigió `/privacidad` (Limited Use, `C-16`) y `/eliminar-datos`
  // (`C-14`), así que esta es la fecha de esa revisión.
  policyEffectiveDate: fromEnv(
    ["NEXT_PUBLIC_MANZANA_POLICY_EFFECTIVE_DATE"],
    "3 de agosto de 2026"
  ),
  policyVersion: fromEnv(["NEXT_PUBLIC_MANZANA_POLICY_VERSION"], "2026-08-03"),
};

const pendingMarkers = ["pendiente", "por configurar"];

export function isConfiguredIdentityValue(value: string) {
  const normalized = value.trim().toLowerCase();

  return (
    Boolean(normalized) &&
    !pendingMarkers.some((marker) => normalized.includes(marker))
  );
}

export function getIdentityReadinessFields() {
  return [
    {
      label: "Operador legal",
      value: publicIdentity.legalOperator,
      ready: isConfiguredIdentityValue(publicIdentity.legalOperator),
    },
    {
      label: "Estado legal",
      value: publicIdentity.legalStatus,
      ready: isConfiguredIdentityValue(publicIdentity.legalStatus),
    },
    {
      label: "Direccion publica",
      value: publicIdentity.publicAddress,
      ready: isConfiguredIdentityValue(publicIdentity.publicAddress),
    },
    {
      label: "Correo de contacto",
      value: publicIdentity.contactEmail,
      ready: isConfiguredIdentityValue(publicIdentity.contactEmail),
    },
    {
      label: "Telefono de contacto",
      value: publicIdentity.contactPhone,
      ready: isConfiguredIdentityValue(publicIdentity.contactPhone),
    },
    {
      label: "Sitio web",
      value: publicIdentity.websiteUrl,
      ready: isConfiguredIdentityValue(publicIdentity.websiteUrl),
    },
  ];
}

export function isIdentityPackageReady() {
  return getIdentityReadinessFields().every((field) => field.ready);
}
