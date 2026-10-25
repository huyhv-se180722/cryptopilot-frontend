// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminReportsPage } from '../../pages/admin/AdminReportsPage';
import type { ModerationService } from '../../services/api/contracts';
import { ServiceError } from '../../services/api/errors';
import { createPendingModerationService } from '../../services/api/moderation';
import type {
  ModerationCase,
  ModerationQueueItem,
  PostDetail,
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
  id: 'p1',
  author: { userId: 'u1', displayName: 'Official desk', avatarUrl: null },
  title: 'Platform update',
  postType: 'TEXT' as const,
  market: null,
  official: true,
  officialCategory: 'ANNOUNCEMENT' as const,
  status: 'PUBLISHED' as const,
  coins: [],
  likeCount: 0,
  commentCount: 0,
  viewCount: 0,
  bullishCount: 0,
  bearishCount: 0,
  myVote: null,
  sentiment: null,
  authorStanding: { influenceScore: 0, followers: 0, followedByMe: false },
  likedByMe: false,
  savedByMe: false,
  createdAt: '2026-10-21T08:00:00Z',
  updatedAt: '2026-10-21T08:00:00Z',
};
const item: ModerationQueueItem = {
  post: { ...base, excerpt: 'Maintenance tonight.', cover: null },
  reportCount: 1,
  reasons: ['SPAM'],
  firstReportedAt: '2026-10-21T09:00:00Z',
  lastReportedAt: '2026-10-21T09:00:00Z',
};
const detail: PostDetail = {
  ...base,
  content: 'Maintenance tonight.',
  media: [],
  mine: false,
};
const opened: ModerationCase = {
  post: detail,
  reports: [
    {
      id: 'r1',
      reporter: { userId: 'u2', displayName: 'Reporter', avatarUrl: null },
      reason: 'SPAM',
      description: null,
      status: 'REVIEWING',
      createdAt: '2026-10-21T09:00:00Z',
    },
  ],
};
const refusal = (status: number, code: string, messageCode: string) =>
  new ServiceError('refused', 'HTTP_ERROR', status, {
    status,
    code,
    messageCode,
    messageArgs: [],
    fieldErrors: {},
  });

function service(over: Partial<ModerationService>): ModerationService {
  return {
    ...createPendingModerationService(),
    queue: async () => ({ items: [item], page: 1, pageSize: 20, total: 1 }),
    open: async () => opened,
    ...over,
  };
}

describe('report moderation screen', () => {
  it('says the feature is not connected while the backend API is pending', async () => {
    await renderRoutes(
      [page('/admin/reports', <AdminReportsPage />)],
      '/admin/reports',
      signedIn,
    );
    expect(
      await screen.findByText(
        'This feature is not connected to the server yet. Please try again later.',
      ),
    ).toBeTruthy();
  });

  it("says an administrator's author cannot be banned (BR-58)", async () => {
    const user = userEvent.setup();
    await renderRoutes(
      [page('/admin/reports', <AdminReportsPage />)],
      '/admin/reports',
      signedIn,
      {
        moderation: service({
          decide: async () => {
            throw refusal(409, 'ACCOUNT_STATUS_TRANSITION_INVALID', 'MSG39');
          },
        }),
      },
    );
    await user.click(
      await screen.findByRole('button', { name: 'Review "Platform update"' }),
    );
    await user.click(await screen.findByRole('button', { name: /Ban author/ }));
    await user.click(screen.getByRole('button', { name: 'Ban author' }));
    expect(
      await screen.findByText(
        'An administrator cannot be banned from here (BR-58).',
      ),
    ).toBeTruthy();
  });

  it('closes the review when the reports were decided meanwhile', async () => {
    const user = userEvent.setup();
    await renderRoutes(
      [page('/admin/reports', <AdminReportsPage />)],
      '/admin/reports',
      signedIn,
      {
        moderation: service({
          decide: async () => {
            throw refusal(404, 'RESOURCE_NOT_FOUND', 'MSG41');
          },
        }),
      },
    );
    await user.click(
      await screen.findByRole('button', { name: 'Review "Platform update"' }),
    );
    await user.click(await screen.findByRole('button', { name: /Keep post/ }));
    expect(
      await screen.findByText(
        'These reports were already decided. The queue has been refreshed.',
      ),
    ).toBeTruthy();
  });
});
