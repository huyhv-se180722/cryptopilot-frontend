import type { Copy } from './en';

type DeepPartial<T> = { readonly [K in keyof T]?: DeepPartial<T[K]> };
export type PartialCopy = DeepPartial<Copy>;

/**
 * Vietnamese locale stub (ADR-014). Intentionally empty: missing keys fall
 * back to English, so translating is a data change, not a refactor.
 */
export const vi: PartialCopy = {
  newsAdmin: {
    crawlTitle: 'Crawl {name} ngay?',
    crawlSchedule: 'Nguồn này được hệ thống tự động crawl mỗi {n} phút.',
    crawlLast: 'Lần gần nhất: {time} ({age}).',
    crawlNever: 'Nguồn chưa được crawl lần nào.',
    crawlNext: 'Lần tự động kế tiếp: {time}.',
    crawlOff: 'Nguồn đang tắt, hệ thống không tự crawl.',
    crawlNote:
      'Crawl ngay sẽ tính lại lịch: lần tự động kế tiếp là một chu kỳ tính từ bây giờ.',
    crawlConfirm: 'Crawl ngay',
    crawling: 'Đang crawl…',
    crawlDone: 'Crawl xong: {inserted} bài mới trong {found} bài.',
    crawlFailed: 'Không đọc được feed: {error}',
    crawledRecently:
      'Nguồn này vừa được crawl chưa đầy một phút. Thử lại sau {seconds} giây.',
    cancel: 'Huỷ',
    ageNow: 'vừa xong',
    ageMinutes: '{n} phút trước',
    ageHours: '{n} giờ trước',
    ageDays: '{n} ngày trước',
  },
};
