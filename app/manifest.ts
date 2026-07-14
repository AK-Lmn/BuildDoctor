import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BuildDoctor',
    short_name: 'BuildDoctor',
    description: 'Turn build failures into a fix plan.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f0f11',
    theme_color: '#f59e0b',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
