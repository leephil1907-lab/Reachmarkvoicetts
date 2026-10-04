const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value.replace(/\/$/, "");
};

export const serverConfig = {
  productName: process.env.REACHMARK_PRODUCT_NAME || "Reachmark Voice",
  ttsUrl: () => required("REACHMARK_TTS_URL"),
  agentUrl: () => required("REACHMARK_AGENT_URL"),
  agentModel: process.env.REACHMARK_AGENT_MODEL || "dolphin-3.0-8b",
  backendToken: process.env.REACHMARK_BACKEND_TOKEN,
  logLevel: process.env.LOG_LEVEL || "info",
};

export function backendHeaders() {
  return {
    "Content-Type": "application/json",
    ...(serverConfig.backendToken
      ? { Authorization: `Bearer ${serverConfig.backendToken}` }
      : {}),
  };
}
