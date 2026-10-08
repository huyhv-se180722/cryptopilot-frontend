import { NavLink, useNavigate } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { Menu } from '../../components/ui/Menu';
import { useCopy } from '../../hooks/use-copy';
import { classNames } from '../../utils/class-names';
import type { NavItem } from './navigation';

const itemClass =
  'relative flex min-w-14 flex-col items-center gap-1 rounded-2xl px-3 py-2';

/**
 * Figma floating mobile dock (below md). Destinations not on the dock stay
 * reachable through "More", so nothing is hidden permanently.
 */
export function MobileDock({
  items,
  more,
}: {
  items: readonly NavItem[];
  more: readonly NavItem[];
}) {
  const copy = useCopy();
  const navigate = useNavigate();
  return (
    <nav
      aria-label={copy.nav.primary}
      className="fixed inset-x-4 bottom-4 z-40 md:hidden"
    >
      <div className="flex items-center justify-around rounded-full border border-(--cp-dock-border) bg-(--cp-dock-bg) px-3 py-2 shadow-overlay backdrop-blur-2xl">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                classNames(
                  itemClass,
                  'no-underline',
                  isActive
                    ? 'border border-primary-line bg-primary-soft text-primary'
                    : 'border border-transparent text-muted-dim',
                )
              }
            >
              <Icon size={20} aria-hidden="true" />
              <span className="text-[9px] font-semibold tracking-wide">
                {copy.nav[item.labelKey]}
              </span>
            </NavLink>
          );
        })}
        <Menu
          label={copy.nav.allDestinations}
          side="top"
          trigger={
            <span
              className={classNames(
                itemClass,
                'border border-transparent text-muted-dim',
              )}
            >
              <MoreHorizontal size={20} aria-hidden="true" />
              <span className="text-[9px] font-semibold tracking-wide">
                {copy.nav.more}
              </span>
            </span>
          }
          items={more.map((item) => {
            const Icon = item.icon;
            return {
              id: item.to,
              label: copy.nav[item.labelKey],
              icon: <Icon size={14} />,
              onSelect: () => navigate(item.to),
            };
          })}
        />
      </div>
    </nav>
  );
}
