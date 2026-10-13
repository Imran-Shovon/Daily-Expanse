import type { NextConfig } from 'next';

/**
 * The browser only ever talks to this Next.js origin. Requests to /api/v1/* are proxied to
 * the NestJS API, so the refresh-token cookie is first-party (SameSite=Strict works) and no
 * API URL or secret is shipped to the client. API_URL is read at build/start time on the server.
 */
const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@expense/shared'],
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiUrl}/api/v1/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
