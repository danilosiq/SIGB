export function Brand({
  markOnly = false,
  className = "",
}: {
  markOnly?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`${markOnly ? "brand-mark" : "brand"} ${className}`}
      role="img"
      aria-label="SIGB — Biblioteca digital"
    >
      <img src="/brand/sigb-mark.svg" width={44} height={44} alt="" />
      {!markOnly && (
        <span className="brand-wordmark">
          SIGB
          <span className="brand-signature" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
