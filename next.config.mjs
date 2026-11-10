/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Native addon + Node-only; must not be bundled into the server runtime.
    // pg does a guarded require of pg-cloudflare inside a try/catch, which the
    // bundler can't statically resolve. Keeping it external avoids the warning
    // and the needless bundle. better-sqlite3 was here until the Postgres move.
    serverComponentsExternalPackages: ["pg"],
  },
};

export default nextConfig;
