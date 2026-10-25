import type { ReactNode } from 'react';
import { classNames } from '../../../utils/class-names';
import { slugSeed, topicVisual } from '../topic-visuals';

/**
 * The cover of an Academy lesson (T-114), drawn rather than downloaded: the
 * topic's gradient and icon, with rings and a grid placed from the lesson's
 * slug so that two lessons of one topic still look different. Decorative:
 * hidden from assistive technology unless it carries children.
 */
export function LessonCover({
  slug,
  topicSlug,
  className,
  iconSize = 56,
  children,
}: {
  slug: string;
  topicSlug: string;
  className?: string;
  iconSize?: number;
  children?: ReactNode;
}) {
  const { icon: Icon, from, to } = topicVisual(topicSlug);
  const seed = slugSeed(slug);
  const angle = 110 + (seed % 70);
  const ringX = 55 + (seed % 35);
  const ringY = 10 + ((seed >> 3) % 60);
  return (
    <div
      aria-hidden={children ? undefined : true}
      className={classNames('relative overflow-hidden', className)}
      style={{
        // A fine grid of 24 px, whatever the width of the cover, over the topic's gradient.
        backgroundImage: [
          'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
          `linear-gradient(${angle}deg, ${from}, ${to})`,
        ].join(', '),
        backgroundSize: '24px 24px, 24px 24px, auto',
      }}
    >
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <circle
          cx={ringX}
          cy={ringY}
          r="34"
          fill="none"
          stroke="white"
          strokeOpacity="0.14"
          strokeWidth="0.8"
        />
        <circle cx={ringX} cy={ringY} r="22" fill="white" fillOpacity="0.07" />
        <circle
          cx={100 - ringX / 2}
          cy={100 - ringY / 3}
          r="18"
          fill="white"
          fillOpacity="0.05"
        />
      </svg>
      <Icon
        size={iconSize}
        strokeWidth={1.4}
        aria-hidden="true"
        className="absolute right-[8%] bottom-[12%] text-white/85 drop-shadow-lg"
      />
      {children && <div className="relative">{children}</div>}
    </div>
  );
}
