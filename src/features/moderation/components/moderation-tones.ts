import type { Tone } from '../../../components/ui/Badge';
import type { PostStatus, ReportReason } from '../../../types/domain';

/** Figma reason colours: scam red, misleading and abuse amber, the rest grey. */
export const reasonTone: Record<ReportReason, Tone> = {
  SCAM: 'danger',
  MISLEADING: 'warning',
  ABUSE: 'warning',
  SPAM: 'neutral',
  OTHER: 'neutral',
};
export const postStatusTone: Record<PostStatus, Tone> = {
  PUBLISHED: 'success',
  HIDDEN: 'warning',
  DELETED: 'danger',
};
