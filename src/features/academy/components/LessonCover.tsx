import { createElement, type ReactNode } from 'react';
import { classNames } from '../../../utils/class-names';
import { topicIcon } from '../topic-visuals';

/**
 * The cover of an Academy lesson (T-114): its photo when it has one, else a
 * plain navy panel with its topic's icon. Text laid over it (the lesson
 * page's banner) sits on a dark veil so it stays readable on any photo.
 * Decorative: hidden from assistive technology unless it carries children.
 */
export function LessonCover({
  topicSlug,
  imageUrl,
  className,
  iconSize = 56,
  children,
}: {
  topicSlug: string;
  imageUrl?: string | null | undefined;
  className?: string;
  iconSize?: number;
  children?: ReactNode;
}) {
  return (
    <div
      aria-hidden={children ? undefined : true}
      className={classNames('relative overflow-hidden bg-[#13284f]', className)}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        createElement(topicIcon(topicSlug), {
          size: iconSize,
          strokeWidth: 1.3,
          'aria-hidden': true,
          className:
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/35',
        })
      )}
      {children && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10"
          />
          <div className="relative">{children}</div>
        </>
      )}
    </div>
  );
}
