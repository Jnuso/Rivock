import fs from "node:fs";
import { loadEnv } from "vite";
import { clerkFrontendOrigin } from "../src/auth/config.ts";
const env = {
  ...loadEnv("production", process.cwd(), "VITE_"),
  ...process.env,
};
const cfg = JSON.parse(
  fs.readFileSync(
    new URL("../public/staticwebapp.config.json", import.meta.url),
    "utf8",
  ),
);
const apiUrl = env.VITE_API_URL || "http://localhost:8000/api/v1";
const api = apiUrl === "/api/v1" ? null : new URL(apiUrl);
const key = (env.VITE_CLERK_PUBLISHABLE_KEY ?? "").trim();
const origin = clerkFrontendOrigin(key);
const environment = env.RIVOCK_BUILD_ENVIRONMENT ||
  (env.RIVOCK_PRODUCTION_BUILD === "true" ? "production" : "local");
if (!["local", "preview", "production"].includes(environment) ||
    (env.RIVOCK_PRODUCTION_BUILD === "true" && environment !== "production")) {
  throw new Error("Select an explicit local, preview or production build environment.");
}
if (
  environment !== "local" &&
  ((api && (api.protocol !== "https:" || api.username || api.password)) ||
    !origin ||
    (environment === "preview" &&
      (!key.startsWith("pk_test_") || env.VITE_APP_ENVIRONMENT !== "preview")) ||
    (environment === "production" &&
      (!key.startsWith("pk_live_") || origin.endsWith(".accounts.dev") ||
        env.VITE_APP_ENVIRONMENT === "preview")))
) {
  throw new Error(
    "Hosted build requires a same-origin /api/v1 or HTTPS API and matching preview/test or production/live Clerk configuration.",
  );
}
const fraud = "https://*.protect.clerk.com";
const cloudflare = "https://challenges.cloudflare.com";
const policy = {
  "default-src": ["'self'"],
  "script-src": ["'self'", ...(origin ? [origin, cloudflare, fraud] : [])],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", ...(origin ? ["https://img.clerk.com"] : [])],
  "connect-src": [
    "'self'",
    ...(api ? [api.origin] : []),
    ...(origin
      ? [
          origin,
          fraud + ":*",
          "https://clerk-telemetry.com",
          "https://*.clerk-telemetry.com",
        ]
      : []),
  ],
  "frame-src": origin ? ["'self'", cloudflare, fraud] : ["'none'"],
  "worker-src": ["'self'", "blob:"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "frame-ancestors": ["'none'"],
  "form-action": ["'self'"],
};
cfg.globalHeaders["Content-Security-Policy"] = Object.entries(policy)
  .map(([name, values]) => `${name} ${values.join(" ")}`)
  .join("; ");
fs.writeFileSync(
  new URL("../dist/staticwebapp.config.json", import.meta.url),
  JSON.stringify(cfg, null, 2) + "\n",
);
