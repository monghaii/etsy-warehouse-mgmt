/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Increase body size limit for file uploads (50MB)
    serverActions: {
      bodySizeLimit: "50mb",
      allowedOrigins: [
        // Extract domain from NEXT_PUBLIC_APP_URL
        process.env.NEXT_PUBLIC_APP_URL
          ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
          : "localhost:3000",
      ],
    },
  },
};

export default nextConfig;
