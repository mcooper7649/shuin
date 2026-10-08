import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Mono, Instrument_Sans } from 'next/font/google';
import { Header } from '@/components/Header';
import { Providers } from '@/components/Providers';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', axes: ['opsz'] });
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-plex-mono' });

export const metadata: Metadata = {
  title: 'Shuin: leave your mark on any chain',
  description: 'Mint NFTs and launch collections on Ethereum, Base, Arbitrum, Optimism, Polygon and Zora.',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${instrument.variable} ${plexMono.variable}`}>
      <body>
        <Providers>
          <div className="shell">
            <Header />
            <main>{children}</main>
            <footer className="foot">
              <span>Shuin · every chain a shrine, every mint a seal</span>
              <a href="https://www.mycodedojo.com">Crafted at MyCodeDojo</a>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
