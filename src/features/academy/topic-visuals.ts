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
 * The icon of an Academy topic, shown on a lesson that has no cover photo
 * yet. Visual configuration only (T-114); a topic the admin adds later
 * without an entry here gets a book.
 */
const ICONS: Readonly<Record<string, LucideIcon>> = {
  'nhap-mon-crypto': Coins,
  'blockchain-cong-nghe': Blocks,
  'vi-bao-mat': ShieldCheck,
  'giao-dich-spot': ArrowLeftRight,
  'futures-don-bay': Gauge,
  'phan-tich-ky-thuat': CandlestickChart,
  'quan-ly-rui-ro': Scale,
  'defi-nft-stablecoin': Layers,
};

export function topicIcon(topicSlug: string): LucideIcon {
  return ICONS[topicSlug] ?? BookOpen;
}
