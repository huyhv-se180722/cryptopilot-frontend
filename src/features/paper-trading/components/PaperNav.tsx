import { NavLink } from 'react-router-dom';
import { useCopy } from '../../../hooks/use-copy';
import { classNames } from '../../../utils/class-names';

/**
 * Sub-navigation of the demo trading area (like the exchange's trade,
 * wallet and orders menus): Spot trade, Wallet, Orders.
 */
export function PaperNav() {
  const copy = useCopy();
  const p = copy.paper;
  const items = [
    { to: '/trade/spot', label: p.navSpot },
    { to: '/trade/wallet', label: p.navWallet },
    { to: '/trade/orders', label: p.navOrders },
    { to: '/trade/pnl', label: p.navPnl },
  ];
  return (
    <nav
      aria-label={p.navLabel}
      className="mb-3 flex gap-1 border-b border-line"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            classNames(
              'relative px-3 py-2 text-xs font-medium no-underline pointer-coarse:py-3',
              isActive
                ? 'text-primary after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                : 'text-muted hover:text-fg-2',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
