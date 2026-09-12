export function RefreshMark() {
  return (
    <p className="refresh-chip" title="Snapshots refresh every hour">
      <span className="refresh-roll" aria-hidden="true" />
      <span>1h</span>
    </p>
  );
}
