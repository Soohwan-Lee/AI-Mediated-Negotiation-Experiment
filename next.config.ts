import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this, Turbopack walks up and picks up a
  // stray package-lock.json outside the repository.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
