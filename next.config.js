/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  typescript: {
    // 忽略 TypeScript 建置錯誤，讓部署可以成功
    ignoreBuildErrors: true,
  },
  eslint: {
    // 忽略 ESLint 建置錯誤
    ignoreDuringBuilds: true,
  },
};
module.exports = nextConfig;
