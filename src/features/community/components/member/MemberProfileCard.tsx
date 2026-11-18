import { Ban, CalendarDays, Link2, MoreHorizontal, Pencil } from 'lucide-react';
import { Menu, type MenuItem } from '../../../../components/ui/Menu';
import { useCopy } from '../../../../hooks/use-copy';
import { formatCopy } from '../../../../i18n/copy';
import type { MemberProfile } from '../../../../types/domain';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../../utils/instant-format';
import { AuthorAvatar, FollowButton } from '../PostParts';
import { compactCount, handleOf } from '../post-format';
import type { PostActions } from '../use-post-interactions';

/**
 * The member's card at the top of the left column, as on CoinMarketCap
 * Community (D-99): the banner with the avatar over its edge, the name and
 * handle, followers and following, the introduction and the link, then
 * Follow (or Edit on one's own page) beside a menu with Block and the
 * page's link. A banner never set is the brand's gradient.
 */
export function MemberProfileCard({
  profile,
  actions,
  onEdit,
  onCopyLink,
}: {
  profile: MemberProfile;
  actions: PostActions;
  onEdit: () => void;
  onCopyLink: () => void;
}) {
  const copy = useCopy();
  const c = copy.community;
  const m = c.member;
  const name = profile.displayName;
  const handle = handleOf(name);
  const canRelate = !profile.me && actions.role !== 'other';
  const menu: MenuItem[] = [
    {
      id: 'copy-link',
      label: m.copyLink,
      icon: <Link2 size={13} />,
      onSelect: onCopyLink,
    },
    ...(canRelate && actions.trader
      ? [
          {
            id: 'block',
            label: profile.blockedByMe
              ? c.unblock
              : formatCopy(c.block, { name }),
            icon: <Ban size={13} />,
            tone: 'danger' as const,
            onSelect: () => void actions.block(profile, !profile.blockedByMe),
          },
        ]
      : []),
  ];
  return (
    <section
      aria-label={formatCopy(m.pageLabel, { name })}
      className="overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <div className="relative h-28">
        {profile.bannerUrl ? (
          <img
            src={profile.bannerUrl}
            alt={formatCopy(m.bannerAlt, { name })}
            className="size-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="size-full bg-linear-135 from-primary-soft via-raised to-accent-soft"
          />
        )}
        {profile.me && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={m.editProfileLink}
            title={m.editProfileLink}
            className="absolute right-3 bottom-3 inline-flex size-8 items-center justify-center rounded-lg border border-line-strong bg-surface/80 text-fg-2 backdrop-blur hover:bg-surface"
          >
            <Pencil size={13} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="px-4 pb-4">
        <div className="-mt-10 flex items-end gap-3">
          <span className="rounded-full bg-surface p-1">
            <AuthorAvatar author={profile} size={84} />
          </span>
        </div>
        <h1 className="mt-2 flex min-w-0 items-center gap-2 text-lg leading-tight font-bold text-fg">
          <span className="truncate">{name}</span>
          {profile.me && (
            <span className="shrink-0 rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {m.you}
            </span>
          )}
        </h1>
        {handle && <p className="text-xs text-muted-dim">{handle}</p>}

        <dl className="mt-3 flex flex-wrap gap-2 text-xs">
          <Count label={m.followers} value={profile.followers} />
          <Count label={m.following} value={profile.following} />
          <Count label={m.posts} value={profile.posts} />
        </dl>

        {profile.bio && (
          <p className="mt-3 text-[13px] leading-relaxed whitespace-pre-line text-fg-2">
            {profile.bio}
          </p>
        )}
        <div className="mt-3 flex flex-col gap-1.5 text-xs text-muted">
          {profile.websiteUrl && (
            <a
              href={profile.websiteUrl}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className="inline-flex max-w-full items-center gap-1.5 text-primary no-underline hover:underline"
            >
              <Link2 size={12} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{linkText(profile.websiteUrl)}</span>
            </a>
          )}
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={12} aria-hidden="true" />
            <time
              dateTime={profile.joinedAt}
              title={formatInstantUtc(profile.joinedAt)}
            >
              {formatCopy(m.joined, {
                date: formatInstantLocal(profile.joinedAt).slice(0, 10),
              })}
            </time>
          </span>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Menu
            label={m.more}
            items={menu}
            trigger={
              <span className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-raised text-fg-2 hover:bg-raised-hover">
                <MoreHorizontal size={14} aria-hidden="true" />
              </span>
            }
          />
          {profile.me ? (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-raised px-3.5 text-xs font-semibold text-fg-2 hover:bg-raised-hover"
            >
              <Pencil size={12} aria-hidden="true" />
              {m.edit}
            </button>
          ) : (
            canRelate &&
            !profile.blockedByMe && (
              <FollowButton
                name={name}
                following={profile.followedByMe}
                pending={actions.following}
                onToggle={(active) =>
                  void actions.follow(profile.userId, active)
                }
              />
            )
          )}
        </div>
      </div>
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="inline-flex items-baseline gap-1 rounded-md bg-raised px-2 py-1">
      <dt className="order-2 text-muted-x">{label}</dt>
      <dd className="order-1 font-mono font-semibold text-fg">
        {compactCount(value)}
      </dd>
    </div>
  );
}

/** The link as people read it: host and path, without the scheme. */
function linkText(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return parsed.host.replace(/^www\./, '') + path;
  } catch {
    return url;
  }
}
