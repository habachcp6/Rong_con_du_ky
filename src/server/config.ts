import dotenv from "dotenv";

dotenv.config();

export type AppEnvironment = "development" | "test" | "production";

export type AppConfig = {
  env: AppEnvironment;
  port: number;
  appVersion: string;
  googleCloudProject: string;
  geminiApiKey: string;
  geminiModel: string;
  googleMapsApiKey: string;
  allowedOrigins: string[];
  allowLocalAuth: boolean;
  starterTrack: true;
};

const toEnvironment = (value: string | undefined): AppEnvironment => {
  if (value === "production" || value === "test") return value;
  return "development";
};

const toPort = (value: string | undefined): number => {
  const parsed = Number.parseInt(value ?? "8080", 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535
    ? parsed
    : 8080;
};

const toOrigins = (value: string | undefined): string[] =>
  (value ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

export function readConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const env = toEnvironment(environment.NODE_ENV);

  return {
    env,
    port: toPort(environment.PORT),
    appVersion: environment.npm_package_version || "0.1.0",
    googleCloudProject: environment.GOOGLE_CLOUD_PROJECT || "rong-con-du-ky",
    geminiApiKey: environment.GEMINI_API_KEY || "",
    geminiModel: environment.GEMINI_MODEL || "gemini-3.6-flash",
    googleMapsApiKey: environment.GOOGLE_MAPS_API_KEY || "",
    allowedOrigins: toOrigins(environment.ALLOWED_ORIGINS),
    // This bypass is deliberately impossible in production. It exists only so
    // a credential-free local/E2E run still exercises authenticated endpoints.
    allowLocalAuth:
      env !== "production" && environment.ALLOW_LOCAL_AUTH !== "false",
    starterTrack: true,
  };
}

export const CONFIG = readConfig();
