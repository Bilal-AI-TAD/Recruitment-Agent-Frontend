import type { NextConfig } from "next";

// A production deployment must call the API over https - never fall back to a local address.
const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const productionDeploy = process.env.VERCEL_ENV === "production" || process.env.APP_ENV === "production";
if (productionDeploy && !/^https:\/\/[^/]+/.test(apiUrl)) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL must be set to the https API address for a production build " +
    "(e.g. https://api.example.com/api/v3).");
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
