import type { Copy } from './en';

type DeepPartial<T> = { readonly [K in keyof T]?: DeepPartial<T[K]> };
export type PartialCopy = DeepPartial<Copy>;

/**
 * Vietnamese locale (ADR-014). Missing keys fall back to English, so
 * translating is a data change, not a refactor. The Academy reads in
 * Vietnamese, as its lessons are written (T-114).
 */
export const vi: PartialCopy = {
  academy: {
    title: 'Học viện Crypto',
    subtitle:
      'Kiến thức crypto giải thích dễ hiểu, từ đồng coin đầu tiên đến quản lý rủi ro.',
    pathTitle: 'Lộ trình cho người mới bắt đầu',
    pathSubtitle: 'Đọc lần lượt các bài này để có nền tảng vững chắc.',
    pathStep: 'Bước {n}',
    topicsTitle: 'Chủ đề',
    topicLessons: '{count} bài học',
    lessonsTitle: 'Bài học',
    allTopics: 'Tất cả chủ đề',
    topicLabel: 'Chủ đề',
    levelLabel: 'Trình độ',
    allLevels: 'Mọi trình độ',
    levels: {
      BEGINNER: 'Cơ bản',
      INTERMEDIATE: 'Trung cấp',
      ADVANCED: 'Nâng cao',
    },
    searchLabel: 'Tìm bài học',
    searchPlaceholder: 'Tìm bài học…',
    noLessons: 'Không có bài học nào khớp với bộ lọc.',
    readingTime: '{minutes} phút đọc',
    pageOf: 'Trang {page}/{pages}',
    previousPage: 'Trang trước',
    nextPage: 'Trang sau',
    glossaryTitle: 'Thuật ngữ',
    glossarySubtitle:
      'Định nghĩa ngắn gọn các thuật ngữ thường gặp trong crypto.',
    glossaryTeaser: 'Gặp một từ chưa hiểu?',
    openGlossary: 'Mở bảng thuật ngữ',
    searchTerms: 'Tìm thuật ngữ',
    searchTermsPlaceholder: 'Tìm thuật ngữ…',
    lettersLabel: 'Lọc theo chữ cái đầu',
    allLetters: 'Tất cả',
    noTerms: 'Không có thuật ngữ nào khớp.',
    readLesson: 'Đọc bài học',
    backToAcademy: 'Quay lại Học viện',
    contents: 'Mục lục',
    summaryTitle: 'Tóm tắt nhanh',
    tryInApp: 'Thử ngay trong ứng dụng',
    previous: 'Bài trước',
    next: 'Bài tiếp theo',
    related: 'Bài liên quan',
    updated: 'Cập nhật {date}',
    notFound: 'Bài học không tồn tại hoặc chưa được xuất bản.',
    disclaimer:
      'Nội dung chỉ nhằm mục đích giáo dục, không phải lời khuyên đầu tư.',
  },
};
