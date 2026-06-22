import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { appBaseUrl } from '@/lib/app-url'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  // Resolves relative OG/canonical/metadata URLs against the one configured base
  // URL, so social/canonical links point at the production domain.
  metadataBase: new URL(appBaseUrl()),
  title: 'CandidVault',
  description: 'Photographer-first event photo collection',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
