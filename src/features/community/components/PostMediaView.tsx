import { Play } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { PostMedia } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';

/** The card preview (SCR-24): the first image, or the video's still. */
export function PostCover({
  cover,
  extra = 0,
}: {
  cover: PostMedia;
  /** Further images of the post, shown as "+n". */
  extra?: number;
}) {
  const copy = useCopy();
  const still = cover.kind === 'VIDEO' ? cover.thumbnailUrl : cover.url;
  return (
    <div className="relative mt-3 aspect-video max-h-72 w-full overflow-hidden rounded-lg border border-line bg-raised">
      {still && (
        <img
          src={still}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      )}
      {cover.kind === 'VIDEO' && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
            <Play size={13} aria-hidden="true" />
            {copy.community.video}
          </span>
        </span>
      )}
      {extra > 0 && (
        <span className="absolute right-2 bottom-2 rounded-md bg-black/60 px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
          {formatCopy(copy.community.moreImages, { n: extra })}
        </span>
      )}
    </div>
  );
}

/** SCR-25: 1–4 images in a grid, or the video with its controls (BR-44). */
export function PostGallery({
  media,
  title,
}: {
  media: readonly PostMedia[];
  title: string;
}) {
  if (media.length === 0) return null;
  const video = media.find((m) => m.kind === 'VIDEO');
  if (video)
    return (
      <video
        controls
        preload="metadata"
        poster={video.thumbnailUrl ?? undefined}
        src={video.url}
        aria-label={title}
        className="mt-4 aspect-video w-full rounded-lg border border-line bg-black"
      />
    );
  return (
    <ul
      className={classNames(
        'mt-4 grid gap-2',
        media.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
      )}
    >
      {media.map((item, index) => (
        <li
          key={item.publicId}
          className={classNames(
            'overflow-hidden rounded-lg border border-line bg-raised',
            media.length === 3 && index === 0 && 'col-span-2',
          )}
        >
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <img
              src={item.url}
              alt={title + ' ' + String(index + 1)}
              loading="lazy"
              width={item.width ?? undefined}
              height={item.height ?? undefined}
              className={classNames(
                'w-full object-cover',
                media.length === 1 ? 'max-h-[480px]' : 'aspect-[4/3]',
              )}
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
