import {
  ArrowLeftRight,
  BookOpen,
  Blocks,
  CandlestickChart,
  Coins,
  Gauge,
  Layers,
  Scale,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

/**
 * How an Academy topic looks: its icon and the two colours of its cover
 * gradient. Visual configuration only (T-114); a topic the admin adds later
 * without an entry here gets the neutral look.
 */
export interface TopicVisual {
  icon: LucideIcon;
  from: string;
  to: string;
}

const VISUALS: Readonly<Record<string, TopicVisual>> = {
  'nhap-mon-crypto': { icon: Coins, from: '#2563eb', to: '#7c3aed' },
  'blockchain-cong-nghe': { icon: Blocks, from: '#0891b2', to: '#2563eb' },
  'vi-bao-mat': { icon: ShieldCheck, from: '#059669', to: '#0d9488' },
  'giao-dich-spot': { icon: ArrowLeftRight, from: '#f59e0b', to: '#ea580c' },
  'futures-don-bay': { icon: Gauge, from: '#e11d48', to: '#9333ea' },
  'phan-tich-ky-thuat': {
    icon: CandlestickChart,
    from: '#4f46e5',
    to: '#0ea5e9',
  },
  'quan-ly-rui-ro': { icon: Scale, from: '#0f766e', to: '#65a30d' },
  'defi-nft-stablecoin': { icon: Layers, from: '#db2777', to: '#7c3aed' },
};

const NEUTRAL: TopicVisual = { icon: BookOpen, from: '#475569', to: '#1e293b' };

export function topicVisual(topicSlug: string): TopicVisual {
  return VISUALS[topicSlug] ?? NEUTRAL;
}

/** A stable small number from a slug, so each lesson's cover differs a little. */
export function slugSeed(slug: string): number {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}
