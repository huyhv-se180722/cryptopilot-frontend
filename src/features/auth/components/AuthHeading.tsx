/** Figma auth heading: 24px title with a muted subtitle. */
export function AuthHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5">
      <h1 className="mb-1 text-2xl font-semibold">{title}</h1>
      {subtitle && <p className="text-sm text-muted-dim">{subtitle}</p>}
    </div>
  );
}
