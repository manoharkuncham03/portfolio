/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Increase API timeout limits
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
  // Configure for better performance with longer responses
  poweredByHeader: false,
  compress: true,
}

export default nextConfig
