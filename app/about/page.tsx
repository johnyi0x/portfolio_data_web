import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "about",
  description:
    "What bagrank is, why it exists, and how the Hyperliquid top-wallet hold map is ranked.",
};

export default function AboutPage() {
  return (
    <main className="page about-page">
      <section className="intro">
        <h1 className="intro-title">About bagrank</h1>
        <p className="intro-copy">
          bagrank is a public data site for crypto perp positioning. It started
          as a tool for trading, and it is being built out as a longer-term
          market-data project. First venue is Hyperliquid. More later.
        </p>
      </section>

      <section className="glass panel about-panel">
        <h2>What it shows</h2>
        <p>
          Each hour it takes the top 200 Hyperliquid wallets by 7-day ROI and
          snapshots the perps they are holding. The heatmap is a crowd hold
          map of that cohort, not a price index and not a dollar-weighted pie.
        </p>
        <p>
          Each wallet gets one vote per pair it actually holds. Idle USDC /
          margin does not vote. A book that is 90% cash and 10% BTC still
          counts as one BTC vote. A wallet in BTC, ETH, and SOL votes once on
          each pair. A 90% bag and a 10% bag are still one and one. Lots under
          about $50 are ignored.
        </p>
        <p>
          For every pair, the majority side wins the color: green long, red
          short. Rank and tile size are how many of those 200 wallets are in
          that pair on the majority side. One whale cannot own the chart.
        </p>
      </section>

      <section className="glass panel about-panel">
        <h2>Why it exists</h2>
        <p>
          Most “smart money” screens are either lagging ROI lists or noisy
          copy-trading feeds. This is the missing layer in between: what the
          current top cohort is holding right now, refreshed every hour, so
          you can see crowd positioning instead of guessing from a leaderboard.
        </p>
        <p>
          v1 is Hyperliquid only. Ranking will get stricter over time. The
          board is public at{" "}
          <a href="https://bagrank.xyz">bagrank.xyz</a>.
        </p>
      </section>
    </main>
  );
}
