/** @type {import('next').NextConfig} */

const nextConfig = {
    webpack: config => {
      config.externals.push('pino-pretty', 'lokijs', 'encoding')
      return config
    },
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'picsum.photos',
        },
        {
          protocol: 'https',
          hostname: 'olive-labour-earthworm-132.mypinata.cloud'
        }
      ],
      domains: ['ipfs.io'],
    },
  }

export default nextConfig;
