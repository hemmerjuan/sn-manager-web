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
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};
module.exports = nextConfig;
