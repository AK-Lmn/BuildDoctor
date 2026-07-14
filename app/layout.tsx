import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BuildDoctor — Turn build failures into a fix plan',
  description: 'BuildDoctor inspects your repository, analyzes build logs, and produces an evidence-backed repair plan. Static analysis — no code execution.',
  applicationName: 'BuildDoctor',
  keywords: ['build failure', 'diagnostics', 'Next.js', 'TypeScript', 'npm', 'CI/CD', 'Vercel', 'Netlify'],
  authors: [{ name: 'BuildDoctor' }],
  creator: 'BuildDoctor',
  robots: 'index, follow',
  openGraph: {
    title: 'BuildDoctor — Turn build failures into a fix plan',
    description: 'Analyze build failures in JavaScript and TypeScript projects. Evidence-backed repair plans.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: 'BuildDoctor',
    description: 'Turn build failures into a fix plan.',
  },
};

export const viewport: Viewport = {
  themeColor: '#f59e0b',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body style={{ background: '#0f0f11', color: '#e8eaf0' }}>
        {children}
      </body>
    </html>
  );
}
