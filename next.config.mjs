/** @type {import('next').NextConfig} */
const nextConfig = {
  // pg and mongodb use Node-only APIs, so keep them out of the bundle
  serverExternalPackages: ['pg', 'mongodb', 'bcryptjs'],
};

export default nextConfig;
