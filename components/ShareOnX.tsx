import { xIntentUrl } from "@/lib/share";

function XMark() {
  return (
    <svg className="share-x-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.1 10.3 22.2 1h-2.3l-6.9 8-5.5-8H1.2l8.5 12.3L1.2 23h2.3l7.4-8.6L16.8 23h6.3l-9-12.7ZM5 2.6h3.5l10.4 18.8h-3.5L5 2.6Z"
      />
    </svg>
  );
}

export function ShareOnX({
  label,
  text,
  url,
}: {
  label: string;
  text: string;
  url: string;
}) {
  return (
    <a
      className="share-x"
      href={xIntentUrl(text, url)}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label} on X`}
    >
      <XMark />
      {label}
    </a>
  );
}
