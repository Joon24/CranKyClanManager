import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '..'),
  experimental: {
    externalDir: true,
    optimizePackageImports: ['@supabase/supabase-js'],
  },
};

export default nextConfig;
