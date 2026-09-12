export function RefreshMark({ capturedAt }: { capturedAt: string | null }) {
  return (
    <p className="refresh-chip" title="Snapshots refresh every hour">
      <span>refresh every 1h</span>
      <span className="refresh-roll" aria-hidden="true" />
      {capturedAt ? <span>last refreshed at {capturedAt} UTC</span> : null}
    </p>
  );
}
