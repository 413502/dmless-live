import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'dmless — Hiring Without the DMs',
  description: 'Automate candidate screening with smart hiring links. No DMs needed.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
