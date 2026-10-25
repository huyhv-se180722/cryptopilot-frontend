import type { Copy } from './en';

type DeepPartial<T> = { readonly [K in keyof T]?: DeepPartial<T[K]> };
export type PartialCopy = DeepPartial<Copy>;

/**
 * Vietnamese locale (ADR-014). Missing keys fall back to English, so
 * translating is a data change, not a refactor; only the news screen is
 * translated so far (T-080).
 */
export const vi: PartialCopy = {
  news: {
    title: 'Tin tức',
    subtitle:
      'Tin crypto tổng hợp, được AI tóm tắt bằng tiếng Việt, mới nhất trước.',
    filtersLabel: 'Lọc tin',
    coinFilter: 'Coin',
    coinPlaceholder: 'Coin, ví dụ BTC',
    sentimentFilter: 'Sentiment',
    sentimentAny: 'Mọi sentiment',
    rangeLabel: 'Khoảng thời gian',
    range24h: '24 giờ',
    range7d: '7 ngày',
    range30d: '30 ngày',
    clearFilters: 'Xoá bộ lọc',
    sentimentBULLISH: 'Tích cực',
    sentimentNEUTRAL: 'Trung tính',
    sentimentBEARISH: 'Tiêu cực',
    summaryTitle: '24 giờ qua',
    summaryLabel: 'Số bài theo sentiment trong 24 giờ qua',
    summaryCount: '{n} bài',
    summaryEmpty: 'Chưa có bài nào trong 24 giờ qua được tóm tắt.',
    aiSummary: 'Tóm tắt bởi AI',
    originalTitle: 'Tiêu đề gốc: {title}',
    readOn: 'Đọc trên {source}',
    empty: 'Chưa có tin',
    emptyFiltered: 'Không có bài nào khớp bộ lọc.',
    emptyHint: 'Bài mới xuất hiện vài phút sau khi các nguồn đăng.',
    loadMore: 'Xem thêm',
    ageNow: 'vừa xong',
    ageMinutes: '{n} phút trước',
    ageHours: '{n} giờ trước',
    ageDays: '{n} ngày trước',
    disclaimer:
      'Tóm tắt và sentiment của AI mô tả bài báo, không phải khuyến nghị mua hay bán.',
    allCoinNews: 'Tất cả tin {coin}',
  },
};
