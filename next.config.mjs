/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force new build ID to bypass cache
  generateBuildId: async () => {
    return `build-${Date.now()}-${Math.random().toString(36).substring(7)}`
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
