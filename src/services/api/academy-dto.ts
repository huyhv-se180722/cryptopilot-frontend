import type {
  AcademyArticle,
  AcademyArticleLink,
  AcademyArticlePage,
  AcademyArticleSummary,
  AcademyCompletedLesson,
  AcademyLevel,
  AcademyProgress,
  AcademyTerm,
  AcademyTopic,
} from '../../types/domain';
import {
  instant,
  integer,
  list,
  nullableText,
  oneOf,
  record,
  text,
} from './decode';

const LEVELS: readonly AcademyLevel[] = [
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
];

function nullableInteger(value: unknown, name: string): number | null {
  return value === null || value === undefined ? null : integer(value, name);
}

export function decodeAcademyTopics(body: unknown): readonly AcademyTopic[] {
  return list(body, 'topics').map((item) => {
    const value = record(item, 'topic');
    return {
      slug: text(value.slug, 'slug'),
      name: text(value.name, 'name'),
      description: text(value.description, 'description'),
      articles: integer(value.articles, 'articles'),
    };
  });
}

function decodeSummary(item: unknown): AcademyArticleSummary {
  const value = record(item, 'article');
  return {
    slug: text(value.slug, 'slug'),
    title: text(value.title, 'title'),
    summary: text(value.summary, 'summary'),
    level: oneOf(LEVELS, value.level, 'level'),
    readingMinutes: integer(value.readingMinutes, 'readingMinutes'),
    topicSlug: text(value.topicSlug, 'topicSlug'),
    topicName: text(value.topicName, 'topicName'),
    pathOrder: nullableInteger(value.pathOrder, 'pathOrder'),
    coverImageUrl: nullableText(value.coverImageUrl, 'coverImageUrl'),
  };
}

function decodeLink(item: unknown, name: string): AcademyArticleLink | null {
  if (item === null || item === undefined) return null;
  const value = record(item, name);
  return { slug: text(value.slug, 'slug'), title: text(value.title, 'title') };
}

export function decodeAcademyArticlePage(body: unknown): AcademyArticlePage {
  const value = record(body);
  return {
    items: list(value.items, 'items').map(decodeSummary),
    page: integer(value.page, 'page'),
    pageSize: integer(value.pageSize, 'pageSize'),
    total: integer(value.total, 'total'),
  };
}

export function decodeAcademyPath(
  body: unknown,
): readonly AcademyArticleSummary[] {
  return list(body, 'path').map(decodeSummary);
}

export function decodeAcademyArticle(body: unknown): AcademyArticle {
  const value = record(body, 'article');
  return {
    ...decodeSummary(value),
    body: text(value.body, 'body'),
    appLink: nullableText(value.appLink, 'appLink'),
    publishedAt: instant(value.publishedAt, 'publishedAt'),
    updatedAt: instant(value.updatedAt, 'updatedAt'),
    previous: decodeLink(value.previous, 'previous'),
    next: decodeLink(value.next, 'next'),
    related: list(value.related, 'related').map(decodeSummary),
    coverCredit: nullableText(value.coverCredit, 'coverCredit'),
  };
}

export function decodeAcademyTerms(body: unknown): readonly AcademyTerm[] {
  return list(body, 'terms').map((item) => {
    const value = record(item, 'term');
    return {
      slug: text(value.slug, 'slug'),
      term: text(value.term, 'term'),
      definition: text(value.definition, 'definition'),
      articleSlug: nullableText(value.articleSlug, 'articleSlug'),
      articleTitle: nullableText(value.articleTitle, 'articleTitle'),
    };
  });
}

export function decodeAcademyCompletedLesson(
  body: unknown,
): AcademyCompletedLesson {
  const value = record(body, 'lesson');
  return {
    slug: text(value.slug, 'slug'),
    completedAt: instant(value.completedAt, 'completedAt'),
  };
}

export function decodeAcademyProgress(body: unknown): AcademyProgress {
  const value = record(body, 'progress');
  return {
    completed: list(value.completed, 'completed').map(
      decodeAcademyCompletedLesson,
    ),
    publishedTotal: integer(value.publishedTotal, 'publishedTotal'),
    pathCompleted: integer(value.pathCompleted, 'pathCompleted'),
    pathTotal: integer(value.pathTotal, 'pathTotal'),
  };
}
