/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Native addon + Node-only; must not be bundled into the server runtime.
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
