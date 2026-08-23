/** @type {import('next').NextConfig} */
const nextConfig = {
  // instrumentation.ts (assertEnv at boot) is experimental in Next.js 14.
  experimental: {
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

module.exports = nextConfig;
