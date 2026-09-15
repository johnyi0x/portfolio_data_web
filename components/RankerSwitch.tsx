"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_RANKER, type Ranker } from "@/lib/ranker";

const OPTIONS: { id: Ranker; label: string }[] = [
  { id: "pnl", label: "PnL ranker" },
  { id: "roi", label: "ROI ranker" },
];

export function RankerSwitch({ value }: { value: Ranker }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(next: Ranker) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === DEFAULT_RANKER) params.delete("ranker");
    else params.set("ranker", next);
    const q = params.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <div className="ranker-switch" role="group" aria-label="Wallet ranker">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={value === opt.id}
          className={value === opt.id ? "on" : undefined}
          onClick={() => select(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
