/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Allow nameplate photos to be submitted with server actions.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
