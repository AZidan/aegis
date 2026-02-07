/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    domains: [],
    formats: ['image/avif', 'image/webp'],
  },
  // Uncomment for production optimizations
  // compiler: {
  //   removeConsole: process.env.NODE_ENV === 'production',
  // },
};

module.exports = nextConfig;
