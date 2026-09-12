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
          bagrank is a public board of what winning Hyperliquid traders are
          holding. It started as a trading tool. It is being built into a
          longer data site. Hyperliquid first, other venues later.
        </p>
      </section>

      <section className="glass panel about-panel">
        <h2>Why it exists</h2>
        <p>
          A 7-day ROI list only tells you who printed. It does not tell you
          what they are sitting in right now. Copy-trading one wallet is the
          other extreme: you inherit that person’s noise, size, and luck.
        </p>
        <p>
          bagrank sits in the middle. Every hour it asks: of the 200 wallets
          that have been making money lately, what are they holding as a
          group? That is crowd positioning, not a price, not a copy-trade
          signal, and not “follow wallet #1.”
        </p>
        <p>
          If 40 of those 200 are long HYPE, that is a different story than
          “HYPE is up on the leaderboard.” If they all dump HYPE by the next
          hour, the tile shrinks. You are watching the crowd’s book, not
          yesterday’s PnL.
        </p>
      </section>

      <section className="glass panel about-panel">
        <h2>Who gets counted</h2>
        <p>
          Each hour: take the top 200 Hyperliquid wallets by 7-day ROI,
          snapshot their open perps, then rank pairs by how many of those
          wallets are in them. Cash is not a pair. This is not a Nasdaq-style
          index with a price.
        </p>
      </section>

      <section className="glass panel about-panel">
        <h2>How a wallet votes</h2>
        <p>
          One wallet, one vote, per perp it actually holds. Size does not buy
          extra votes. Side still matters (long or short).
        </p>
        <ul>
          <li>
            90% USDC sitting as margin and a 10% BTC perp: 1 BTC vote. USDC
            does not appear on the map.
          </li>
          <li>
            BTC, ETH, and SOL all open: 1 vote on BTC, 1 on ETH, 1 on SOL.
            The wallet is not forced to pick a “main” bag.
          </li>
          <li>
            80% long ETH and 12% long a memecoin: still 1 ETH and 1 memecoin.
            The ETH bag is not worth 8 votes.
          </li>
          <li>
            Long BTC and short SOL: 1 BTC long vote and 1 SOL short vote.
            Same wallet can color one tile green and another red.
          </li>
          <li>
            Five small alt perps and no majors: five votes, one per alt. A
            diversified book is not collapsed into its largest line.
          </li>
          <li>
            A leftover fill under about $50: ignored, so dust after a close
            does not spam the board.
          </li>
          <li>
            No open perps, only cash: 0 votes. That wallet is in the 200 for
            ROI but does not move any tile.
          </li>
          <li>
            One whale 100% long BTC vs 30 small wallets each 5% long BTC: 31
            BTC votes, not “the whale owns the tile.” Dollars do not rank the
            map.
          </li>
        </ul>
      </section>

      <section className="glass panel about-panel">
        <h2>How pairs get ranked</h2>
        <p>
          For each pair, count how many of the 200 are long vs short. The
          bigger side wins the color: green long, red short. Rank and tile
          size are how many wallets are on that winning side. Agreement is
          how one-sided that pair is (20 long / 2 short is high agreement).
        </p>
        <p>
          Example: 23 wallets long NEAR, 1 short. NEAR is green. If 23 is
          the highest wallet count this hour, NEAR is rank 1 and gets the
          biggest tile. Next hour, if only 8 still hold it, NEAR shrinks
          even if those 8 have huge size.
        </p>
        <p>
          Public board: <a href="https://bagrank.xyz">bagrank.xyz</a>. v1 is
          Hyperliquid only.
        </p>
      </section>
    </main>
  );
}
