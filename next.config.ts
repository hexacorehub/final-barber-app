import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Next 16 auto-generates AGENTS.md / CLAUDE.md otherwise.
  agentRules: false,
  experimental: {
    // Client router cache: a screen opened in the last minute reopens instantly, without a
    // server round trip. Every server action that changes data calls revalidatePath, which
    // clears this cache, so new bookings, requests and people show up right away.
    staleTimes: { dynamic: 60, static: 300 },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
