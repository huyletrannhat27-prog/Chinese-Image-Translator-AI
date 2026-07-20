import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import PwaRegister from '@/components/PwaRegister';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hanzi Lens — Dịch ảnh Trung Việt',
  description: 'Chụp hoặc tải ảnh để nhận diện và dịch tiếng Trung sang tiếng Việt bằng AI.',
  manifest: '/manifest.json',
  applicationName: 'Hanzi Lens',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Hanzi Lens' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#4f46e5',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={inter.className}>
        <PwaRegister />
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
