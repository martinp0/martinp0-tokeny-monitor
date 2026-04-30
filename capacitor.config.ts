import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.b48d9da47c50412fae3399abd4c428cd",
  appName: "OpenRouter Monitor",
  webDir: "dist",
  server: {
    url: "https://b48d9da4-7c50-412f-ae33-99abd4c428cd.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  ios: {
    contentInset: "always",
  },
  android: {
    backgroundColor: "#0F0A1A",
  },
};

export default config;
