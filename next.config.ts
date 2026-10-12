import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep type checking enabled through the installed compiler API, and run
    // build workers in threads on Windows environments that block child processes.
    useTypeScriptCli: false,
    workerThreads: true,
  },
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*", headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ]
    }];
  },
};

export default nextConfig;
