import { LaunchForm } from '@/components/LaunchForm';
import { ShrinePicker } from '@/components/ShrinePicker';

export const metadata = { title: 'Launch a collection · Shuin' };

export default function LaunchPage() {
  return (
    <>
      <section style={{ padding: '48px 0 28px' }} className="stack">
        <h1 style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)' }}>Launch your own collection</h1>
        <p className="lede" style={{ margin: 0, maxWidth: '52ch' }}>
          Your own contract with your name on it. Set a price, supply, mint window and royalties, and get a mint page you can share.
        </p>
        <ShrinePicker />
      </section>
      <LaunchForm />
    </>
  );
}
