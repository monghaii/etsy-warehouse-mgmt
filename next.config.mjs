/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Increase body size limit for file uploads (50MB)
    serverActions: {
      bodySizeLimit: "50mb",
      allowedOrigins: ["localhost:3000"],
    },
  },
};

export default nextConfig;
