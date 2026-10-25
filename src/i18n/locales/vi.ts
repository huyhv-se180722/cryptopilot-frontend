import type { Copy } from './en';

type DeepPartial<T> = { readonly [K in keyof T]?: DeepPartial<T[K]> };
export type PartialCopy = DeepPartial<Copy>;

/**
 * Vietnamese locale (ADR-014). Missing keys fall back to English, so
 * translating is a data change, not a refactor; only the news screens are
 * translated so far (T-080), and they render in Vietnamese (D-125).
 */
export const vi: PartialCopy = {
  news: {
    title: 'Tin tức',
    subtitle:
      'Tin tức tiền mã hoá tổng hợp từ nhiều nguồn, được AI biên tập lại bằng tiếng Việt.',
    filtersLabel: 'Lọc tin',
    coinFilter: 'Coin',
    coinPlaceholder: 'Mã coin, ví dụ BTC',
    sentimentFilter: 'Xu hướng',
    sentimentAny: 'Mọi xu hướng',
    rangeLabel: 'Khoảng thời gian',
    range24h: '24 giờ',
    range7d: '7 ngày',
    range30d: '30 ngày',
    clearFilters: 'Xoá bộ lọc',
    sentimentBULLISH: 'Tích cực',
    sentimentNEUTRAL: 'Trung lập',
    sentimentBEARISH: 'Tiêu cực',
    aiSummary: 'AI tóm tắt',
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
      'Nội dung và đánh giá xu hướng do AI tạo từ bài báo gốc, không phải khuyến nghị mua hay bán.',
    allCoinNews: 'Tất cả tin {coin}',
    backToNews: 'Tất cả tin tức',
    articleNotFound: 'Bài viết không còn',
    articleNotFoundHint: 'Bài có thể đã bị gỡ khỏi trang tin.',
    publishedOn: 'Đăng lúc {date}',
    imageCredit: 'Ảnh: {source}',
    sourceLabel: 'Nguồn',
    readOriginal: 'Xem bài gốc',
    aiRewritten:
      'Bài viết được AI biên tập lại và rút gọn từ bài gốc. Số liệu và trích dẫn lấy từ nguồn; vui lòng xem bài gốc để biết chi tiết. Đây không phải khuyến nghị mua hay bán.',
    bodyPending:
      'Bài viết đầy đủ đang được biên tập; tạm thời đây là bản tóm tắt.',
    excerptOnly:
      'Bài này chưa được AI biên tập; đây là đoạn trích từ nguồn. Xem bài gốc để đọc đầy đủ.',
  },
  marketOverview: {
    title: 'Thị trường',
    tabsLabel: 'Tổng quan thị trường',
    tab_spot: 'Spot',
    tab_futures: 'Futures',
    tab_gainers: 'Tăng mạnh',
    tab_losers: 'Giảm mạnh',
    rangeLabel: 'Khoảng thời gian biểu đồ',
    chartLabel: 'Giá {pair} trong {range}',
    chartUnavailable: 'Chưa tải được biểu đồ.',
    empty: 'Chưa có cặp nào để hiển thị.',
    pair: 'Cặp',
    price: 'Giá',
    change: 'Thay đổi',
    changePercent: '% thay đổi',
    allMarkets: 'Xem toàn bộ thị trường →',
  },
};
