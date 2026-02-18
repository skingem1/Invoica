import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Invoica — The Financial OS for AI Agents',
  description: 'Automated invoicing, tax compliance, and settlement detection for AI agents. Built on the x402 protocol.',
  keywords: ['AI agent payments', 'x402 invoicing', 'agent financial OS', 'machine-to-machine payments', 'autonomous agent billing'],
  openGraph: {
    title: 'Invoica — The Financial OS for AI Agents',
    description: 'Automated invoicing, tax compliance, and settlement detection for AI agents.',
    url: 'https://invoica.ai',
    siteName: 'Invoica',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Invoica — The Financial OS for AI Agents',
    description: 'Automated invoicing, tax compliance, and settlement detection for AI agents.',
    creator: '@NexusCollectv',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-invoica-blue antialiased">{children}</body>
    </html>
  );
}
