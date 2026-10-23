import logoDark from '../../assets/brand/logo-dark.png';
import logoLight from '../../assets/brand/logo-light.png';
import markDark from '../../assets/brand/mark-dark.png';
import markLight from '../../assets/brand/mark-light.png';
import { useCopy } from '../../hooks/use-copy';
import { useTheme } from '../../hooks/use-theme';

type LogoSize = 'xs' | 'sm' | 'md' | 'lg';

/** Rendered height in px; the mark sets the height of the full lockup. */
const HEIGHT: Record<LogoSize, number> = { xs: 18, sm: 24, md: 32, lg: 44 };

/**
 * Official CryptoPilot logo (owner-supplied artwork). The dark variant
 * swaps the navy parts for white so the lockup reads on dark surfaces;
 * `onDark` asks for it whatever the theme (the sign-in brand panel).
 */
export function CryptoPilotLogo({
  size = 'sm',
  showText = true,
  onDark = false,
}: {
  size?: LogoSize;
  showText?: boolean;
  onDark?: boolean;
}) {
  const copy = useCopy();
  const dark = useTheme().resolved === 'dark' || onDark;
  const src = showText
    ? dark
      ? logoDark
      : logoLight
    : dark
      ? markDark
      : markLight;
  return (
    <img
      src={src}
      alt={copy.product.name}
      height={HEIGHT[size]}
      draggable={false}
      className="block w-auto shrink-0 select-none"
      style={{ height: HEIGHT[size] }}
    />
  );
}
