import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `postgres` is a native-ish driver that must not be bundled into the
  // server chunks; Next then `require`s it at runtime from node_modules.
  serverExternalPackages: ['postgres'],

  images: {
    /**
     * Content images live in a public Supabase Storage bucket and the
     * database stores their absolute URLs (D-026), so `next/image` has to be
     * told the host is allowed — an unlisted one is a hard 400 at render.
     *
     * Any project ref, but only the public read path of Storage: this is a
     * list of hosts whose images this site will optimize and serve from its
     * own domain, so it should not read as "anything on supabase.co". It is
     * a wildcard rather than this project's ref because it is a build-time
     * constant and `next build` runs with no environment (D-002).
     */
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
