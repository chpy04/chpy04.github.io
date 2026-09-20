import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `postgres` is a native-ish driver that must not be bundled into the
  // server chunks; Next then `require`s it at runtime from node_modules.
  serverExternalPackages: ['postgres'],
};

export default nextConfig;
