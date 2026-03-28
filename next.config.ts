import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ['192.168.1.136', 'http://192.168.1.136:3000', '192.168.1.136:3000'],
};

export default nextConfig;
