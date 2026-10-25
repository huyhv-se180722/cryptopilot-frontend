import { NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  Bookmark,
  ChevronDown,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { Menu } from '../../../components/ui/Menu';
import { useAuth } from '../../../hooks/use-auth';
import { useCopy } from '../../../hooks/use-copy';
import { classNames } from '../../../utils/class-names';
import { memberPath } from './post-format';

const tab = ({ isActive }: { isActive: boolean }) =>
  classNames(
    'relative inline-flex h-12 items-center px-1 text-lg font-semibold whitespace-nowrap no-underline transition-colors duration-150 sm:text-xl',
    isActive
      ? 'text-fg after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
      : 'text-muted-x hover:text-fg-2',
  );

/**
 * The section bar of CoinMarketCap Community: Feeds, Topics, Articles,
 * My Page and More, with Notifications on the right (D-99). Lives has no
 * counterpart here and is left out.
 */
export function CommunityNav({ trader }: { trader: boolean }) {
  const c = useCopy().community;
  const navigate = useNavigate();
  const me = useAuth().session?.user.id;
  return (
    <div className="mb-5 flex items-center gap-4 border-b border-line">
      <nav
        aria-label={c.navLabel}
        className="flex min-w-0 flex-1 items-center gap-5 overflow-x-auto sm:gap-7"
      >
        <NavLink to="/community" end className={tab}>
          {c.navFeeds}
        </NavLink>
        <NavLink to="/community/topics" className={tab}>
          {c.navTopics}
        </NavLink>
        <NavLink to="/community/articles" className={tab}>
          {c.navArticles}
        </NavLink>
        {trader && me && (
          <NavLink to={memberPath(me)} className={tab}>
            {c.navMyPage}
          </NavLink>
        )}
        <Menu
          label={c.navMore}
          align="start"
          items={[
            ...(trader
              ? [
                  {
                    id: 'saved',
                    label: c.tabSaved,
                    icon: <Bookmark size={13} />,
                    onSelect: () => navigate('/community?tab=SAVED'),
                  },
                  {
                    id: 'mine',
                    label: c.tabMine,
                    icon: <FileText size={13} />,
                    onSelect: () => navigate('/community?tab=MINE'),
                  },
                ]
              : []),
            {
              id: 'rules',
              label: c.navRules,
              icon: <ShieldCheck size={13} />,
              onSelect: () =>
                document
                  .getElementById('community-rules')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
            },
          ]}
          trigger={
            <span className="inline-flex h-12 items-center gap-1 px-1 text-lg font-semibold text-muted-x hover:text-fg-2 sm:text-xl">
              {c.navMore}
              <ChevronDown size={16} aria-hidden="true" />
            </span>
          }
        />
      </nav>
      {trader && (
        <NavLink
          to="/notifications"
          className="hidden h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-raised px-3 text-xs font-semibold text-fg-2 no-underline hover:bg-raised-hover sm:inline-flex"
        >
          <Bell size={13} aria-hidden="true" />
          {c.navNotifications}
        </NavLink>
      )}
    </div>
  );
}
