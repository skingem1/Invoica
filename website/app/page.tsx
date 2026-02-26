import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import CodeExample from '@/components/CodeExample';
import BetaBanner from '@/components/BetaBanner';
import Footer from '@/components/Footer';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <CodeExample />
        <BetaBanner />
      </main>
      <Footer />
    </>
  );
}
