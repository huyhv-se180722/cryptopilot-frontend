// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminAnnouncementEditorPage } from '../../pages/admin/AdminAnnouncementEditorPage';
import { AdminAnnouncementsPage } from '../../pages/admin/AdminAnnouncementsPage';
import { createPendingAnnouncementService } from '../../services/api/announcements';
import type { AnnouncementService } from '../../services/api/contracts';
import type {
  AnnouncementDraft,
  PostDetail,
  PostSummary,
  Session,
} from '../../types/domain';
import { fakeAuth, page, renderRoutes } from '../../test/render';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const admin: Session = {
  user: {
    id: 'test-admin',
    email: 'admin@example.test',
    displayName: 'Test Admin',
    role: 'Admin',
    status: 'active',
  },
  entitlements: 'unknown',
};
const signedIn = fakeAuth({ restoreSession: async () => admin });

const base = {
  id: 'a1',
  author: { userId: 'test-admin', displayName: 'Test Admin', avatarUrl: null },
  title: 'Maintenance window',
  postType: 'TEXT' as const,
  market: null,
  official: true,
  officialCategory: 'PLATFORM_UPDATE' as const,
  status: 'PUBLISHED' as const,
  coins: ['BTC'],
  likeCount: 3,
  commentCount: 1,
  likedByMe: false,
  savedByMe: false,
  createdAt: '2026-10-23T05:00:00Z',
  updatedAt: '2026-10-23T05:00:00Z',
};
const summary: PostSummary = {
  ...base,
  excerpt: 'Maintenance tonight.',
  cover: null,
};
const detail: PostDetail = {
  ...base,
  content: 'Maintenance tonight.',
  media: [],
  mine: true,
};

function service(overrides: Partial<AnnouncementService>): AnnouncementService {
  return { ...createPendingAnnouncementService(), ...overrides };
}

describe('announcement screens (UC-44)', () => {
  it('lists announcements, filters a category and deletes after asking', async () => {
    const user = userEvent.setup();
    const asked: (string | undefined)[] = [];
    const removed: string[] = [];
    await renderRoutes(
      [page('/admin/announcements', <AdminAnnouncementsPage />)],
      '/admin/announcements',
      signedIn,
      {
        announcements: service({
          list: async (q) => {
            asked.push(q.category);
            return {
              items: q.category === 'EDUCATION' ? [] : [summary],
              page: 1,
              pageSize: 20,
              total: q.category === 'EDUCATION' ? 0 : 1,
            };
          },
          remove: async (id) => {
            removed.push(id);
          },
        }),
      },
    );
    expect(await screen.findByText('Maintenance window')).toBeTruthy();
    expect(screen.getAllByText('Platform update').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('radio', { name: 'Education' }));
    expect(
      await screen.findByText('No announcements in this category.'),
    ).toBeTruthy();
    expect(asked).toContain('EDUCATION');
    await user.click(screen.getByRole('radio', { name: 'All' }));
    await user.click(
      await screen.findByRole('button', {
        name: 'Delete "Maintenance window"',
      }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Delete this announcement?',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Announcement deleted.')).toBeTruthy();
    expect(removed).toEqual(['a1']);
  });

  it('goes back to the last page when a deletion empties the one shown', async () => {
    const user = userEvent.setup();
    let stored: PostSummary[] = Array.from({ length: 21 }, (_, i) => ({
      ...summary,
      id: `a${String(i + 1)}`,
      title: `Announcement ${String(i + 1)}`,
    }));
    await renderRoutes(
      [page('/admin/announcements', <AdminAnnouncementsPage />)],
      '/admin/announcements',
      signedIn,
      {
        announcements: service({
          list: async (q) => ({
            items: stored.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
            page: q.page,
            pageSize: q.pageSize,
            total: stored.length,
          }),
          remove: async (id) => {
            stored = stored.filter((post) => post.id !== id);
          },
        }),
      },
    );
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Announcement 21')).toBeTruthy();
    await user.click(
      screen.getByRole('button', { name: 'Delete "Announcement 21"' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Delete this announcement?',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Announcement 1')).toBeTruthy();
    expect(screen.queryByText('No announcements yet')).toBeNull();
  });

  it('edits with the loaded category and no media (Q-79)', async () => {
    const user = userEvent.setup();
    const saved: AnnouncementDraft[] = [];
    await renderRoutes(
      [
        page('/admin/announcements/:postId', <AdminAnnouncementEditorPage />),
        page('/admin/announcements', <p>List</p>),
      ],
      '/admin/announcements/a1',
      signedIn,
      {
        announcements: service({
          get: async () => detail,
          update: async (_id, draft) => {
            saved.push(draft);
            return detail;
          },
        }),
      },
    );
    const category = await screen.findByRole('combobox', { name: 'Category' });
    expect((category as HTMLSelectElement).value).toBe('PLATFORM_UPDATE');
    expect(screen.queryByText('Add images')).toBeNull();
    await user.selectOptions(category, 'EDUCATION');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('List')).toBeTruthy();
    expect(saved[0]).toMatchObject({
      title: 'Maintenance window',
      coins: ['BTC'],
      media: [],
      officialCategory: 'EDUCATION',
    });
  });

  it('does not edit a hidden announcement', async () => {
    await renderRoutes(
      [page('/admin/announcements/:postId', <AdminAnnouncementEditorPage />)],
      '/admin/announcements/a1',
      signedIn,
      {
        announcements: service({
          get: async () => ({ ...detail, status: 'HIDDEN' }),
        }),
      },
    );
    expect(
      await screen.findByText('A hidden announcement cannot be edited.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  });
});
