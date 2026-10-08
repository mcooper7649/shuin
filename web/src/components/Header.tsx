'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from './ConnectButton';
import { SealMark } from './Logo';

const LINKS = [
  { href: '/', label: 'Seal' },
  { href: '/launch', label: 'Launch a collection' },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Shuin home">
        <SealMark />
        <span className="brand-word">Shuin</span>
      </Link>
      <nav className="nav">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={path === l.href ? 'page' : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
      <ConnectButton />
    </header>
  );
}
