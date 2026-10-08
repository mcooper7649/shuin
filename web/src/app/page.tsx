import { ShrinePicker } from '@/components/ShrinePicker';
import { SealForm } from '@/components/SealForm';
import { OPEN_BOOK_ADDRESS } from '@/lib/chains';

const FEATURES = [
  { icon: '◇', title: 'Any chain', text: 'Ethereum, Base, Arbitrum, Optimism, Polygon and Zora, with one contract address on all of them.' },
  { icon: '▶', title: 'Stored on-chain', text: 'Images and metadata live inside the contract itself, with no IPFS link to rot. Video, audio and 3D can use IPFS.' },
  { icon: '⌘', title: 'Your own collection', text: 'Launch a collection with royalties, a price, supply cap, mint window and allowlist.' },
  { icon: '∞', title: 'Soulbound option', text: 'Mint credentials and badges that can never be transferred (ERC-5192).' },
];

export default function Home() {
  return (
    <section className="hero">
      <div>
        <h1>
          Leave your mark.
          <br />
          <em>On any chain.</em>
        </h1>
        <p className="lede">Drop in your work, choose a chain, and press your seal. It’s yours, on-chain, in under a minute.</p>
        <ul className="features">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className="feat-ico" aria-hidden>{f.icon}</span>
              <div>
                <b>{f.title}</b>
                <span>{f.text}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="stack">
        <div className="stack" style={{ gap: 8 }}>
          <span className="section-title">Choose your chain</span>
          <ShrinePicker />
        </div>
        <SealForm collection={OPEN_BOOK_ADDRESS} />
        <p className="hint" style={{ margin: 0 }}>
          Seals here go into the free, public <b>Shuin Open Book</b> collection. Want your own contract with royalties? <a href="/launch">Launch a collection</a>.
        </p>
      </div>
    </section>
  );
}
