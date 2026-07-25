import { getKapsoSendConfigFromEnv } from "./kapso-sender";
import { getMetaCloudSendConfigFromEnv } from "./meta-cloud-sender";
import type { WhatsAppSendConfig } from "./outbound-service";
import type { WhatsAppProvider } from "./types";
import { getYCloudSendConfigFromEnv } from "./ycloud-sender";

export function getWhatsAppProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): WhatsAppProvider {
  if (env.WHATSAPP_PROVIDER === "meta_cloud") return "meta_cloud";
  if (env.WHATSAPP_PROVIDER === "ycloud") return "ycloud";
  return "kapso";
}

export function getWhatsAppSendConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): WhatsAppSendConfig {
  const provider = getWhatsAppProviderFromEnv(env);
  if (provider === "kapso") {
    return {
      provider,
      kapso: getKapsoSendConfigFromEnv(env),
    };
  }
  if (provider === "meta_cloud") {
    return {
      provider,
      metaCloud: getMetaCloudSendConfigFromEnv(env),
    };
  }
  return {
    provider,
    ycloud: getYCloudSendConfigFromEnv(env),
  };
}

export function isWhatsAppSendConfigReady(
  config: WhatsAppSendConfig,
): boolean {
  if (config.provider === "meta_cloud") {
    return Boolean(config.metaCloud.accessToken && config.metaCloud.phoneNumberId);
  }
  if (config.provider === "kapso") {
    return Boolean(config.kapso.apiKey && config.kapso.phoneNumberId);
  }
  return Boolean(config.ycloud.apiKey && config.ycloud.fromPhone);
}
