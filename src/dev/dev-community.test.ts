import { describe, expect, it } from 'vitest';
import type { Session } from '../types/domain';
import { createDevelopmentCommunity } from './dev-community';
import { devPrincipals } from './fixtures/auth';

const principal = (id: string) =>
  devPrincipals.find((p) => p.user.id === id) as Session;

function setup(session: Session | null) {
  return createDevelopmentCommunity(async () => session).community;
}
const codeOf = (error: unknown) =>
  (error as { problem?: { code: string } }).problem?.code;

describe('development community', () => {
  it('lets a Guest read the shared tabs but not SAVED or MINE (MSG44)', async () => {
    const guest = setup(null);
    const latest = await guest.feed({ tab: 'LATEST', page: 1, pageSize: 20 });
    expect(latest.items.length).toBeGreaterThan(0);
    expect(latest.items.every((p) => !p.official)).toBe(true);
    await expect(
      guest.feed({ tab: 'SAVED', page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('shows the hidden own post only in My posts', async () => {
    const trader = setup(principal('dev-free'));
    const mine = await trader.feed({ tab: 'MINE', page: 1, pageSize: 20 });
    expect(mine.items.some((p) => p.status === 'HIDDEN')).toBe(true);
    const latest = await trader.feed({ tab: 'LATEST', page: 1, pageSize: 20 });
    expect(latest.items.some((p) => p.status === 'HIDDEN')).toBe(false);
  });

  it('refuses a second report and a report of an own post (BR-46)', async () => {
    const trader = setup(principal('dev-free'));
    const repeated = await trader
      .report('dev-post-3', { reason: 'SPAM', description: null })
      .catch(codeOf);
    expect(repeated).toBe('POST_ALREADY_REPORTED');
    const own = await trader
      .report('dev-post-mine-1', { reason: 'SPAM', description: null })
      .catch(codeOf);
    expect(own).toBe('POST_REPORT_OWN_POST');
  });

  it('attaches a reply to a reply to its thread (one level)', async () => {
    const trader = setup(principal('dev-free'));
    const reply = await trader.comment(
      'dev-post-1',
      'Nested?',
      'dev-comment-2',
    );
    expect(reply.parentCommentId).toBe('dev-comment-1');
  });

  it('keeps video posting for plans with VIDEO_POST (MSG29)', async () => {
    const video = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    const refused = await setup(principal('dev-free'))
      .upload(video, 'VIDEO')
      .catch(codeOf);
    expect(refused).toBe('PLAN_FEATURE_NOT_INCLUDED');
  });

  it('checks the PostRequest fields and the coins of listed pairs', async () => {
    const trader = setup(principal('dev-pro'));
    const error = await trader
      .create({
        title: 'abc',
        content: ' ',
        market: null,
        coins: ['NOTACOIN'],
        media: [],
      })
      .catch((e: unknown) => e);
    expect(
      (error as { problem: { fieldErrors: object } }).problem.fieldErrors,
    ).toEqual({ title: 'MSG01', content: 'MSG01', coins: 'MSG01' });
  });

  it('moderates over the same posts: open, decide, restore (SCR-36)', async () => {
    const admin = principal('dev-admin');
    const both = createDevelopmentCommunity(async () => admin);
    const queue = await both.moderation.queue(1, 20);
    expect(queue.items.map((i) => i.post.id)).toEqual([
      'dev-post-4',
      'dev-post-3',
      'dev-post-2',
    ]);
    const opened = await both.moderation.open('dev-post-4');
    expect(opened.reports.every((r) => r.status === 'REVIEWING')).toBe(true);
    const result = await both.moderation.decide(
      'dev-post-4',
      'HIDE_POST',
      null,
    );
    expect(result).toMatchObject({ postStatus: 'HIDDEN', resolvedReports: 2 });
    expect((await both.moderation.queue(1, 20)).total).toBe(2);
    expect((await both.moderation.restore('dev-post-4')).status).toBe(
      'PUBLISHED',
    );
  });

  it('refuses moderation to a Trader', async () => {
    const both = createDevelopmentCommunity(async () => principal('dev-free'));
    expect(await both.moderation.queue(1, 20).catch(codeOf)).toBe(
      'ACCESS_DENIED',
    );
    expect(
      await both.announcements.list({ page: 1, pageSize: 20 }).catch(codeOf),
    ).toBe('ACCESS_DENIED');
  });

  it('publishes an announcement pinned in the feed, edits and deletes it (UC-44)', async () => {
    let session: Session | null = principal('dev-admin');
    const dev = createDevelopmentCommunity(async () => session);
    const draft = {
      title: 'Maintenance window',
      content: 'Platform maintenance tonight.',
      market: null,
      coins: [],
      media: [],
      officialCategory: 'PLATFORM_UPDATE',
    } as const;
    const post = await dev.announcements.create(draft);
    const edited = await dev.announcements.update(post.id, {
      ...draft,
      officialCategory: 'EDUCATION',
    });
    expect(edited.officialCategory).toBe('EDUCATION');
    const education = await dev.announcements.list({
      category: 'EDUCATION',
      page: 1,
      pageSize: 20,
    });
    expect(education.items[0]?.id).toBe(post.id);
    session = null;
    const pinned = await dev.community.pinned({ page: 1, pageSize: 20 });
    expect(pinned.items[0]?.id).toBe(post.id);
    session = principal('dev-admin');
    await dev.announcements.remove(post.id);
    expect(await dev.announcements.get(post.id)).toMatchObject({
      status: 'DELETED',
    });
    expect(await dev.announcements.update(post.id, draft).catch(codeOf)).toBe(
      'RESOURCE_NOT_FOUND',
    );
  });
});
