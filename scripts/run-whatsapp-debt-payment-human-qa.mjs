import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  tsconfigPaths: true,
});

await jiti.import("./manage-whatsapp-debt-payment-human-qa.ts");
