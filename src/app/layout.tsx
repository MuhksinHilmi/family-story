import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppSidebar } from '@/components/app-sidebar';
import { AuthProvider } from '@/context/auth-context';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Cerita Keluarga - Muslim Family Tree Platform',
  description: 'Platform untuk mendaftarkan dan memvisualisasikan silsilah keluarga Muslim',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <AppSidebar>{children}</AppSidebar>
        </AuthProvider>
      </body>
    </html>
  );
}