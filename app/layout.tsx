import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BuildDoctor',
  description: 'BuildDoctor inspects your repository, analyzes build logs, and produces an evidence-backed repair plan. Static analysis — no code execution.',
  applicationName: 'BuildDoctor',
  keywords: ['build failure', 'diagnostics', 'Next.js', 'TypeScript', 'npm', 'CI/CD', 'Vercel', 'Netlify'],
  authors: [{ name: 'BuildDoctor' }],
  creator: 'BuildDoctor',
  robots: 'index, follow',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'BuildDoctor',
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
  themeColor: '#9d7bff',
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
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
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
