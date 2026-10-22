// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommunityPage } from '../../pages/trader/CommunityPage';
import { PostEditorPage } from '../../pages/trader/PostEditorPage';
import type { CommunityService } from '../../services/api/contracts';
import { createPendingCommunityService } from '../../services/api/community';
import { ServiceError } from '../../services/api/errors';
import type { Session } from '../../types/domain';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const free: Session = {
  ...testTrader,
  entitlements: { tier: 'FREE', features: [], limits: {} },
};
const signedIn = (session: Session) =>
  fakeAuth({ restoreSession: async () => session });

const emptyPage = { items: [], page: 1, pageSize: 20, total: 0 };
function community(overrides: Partial<CommunityService>): CommunityService {
  return {
    ...createPendingCommunityService(),
    feed: async () => emptyPage,
    pinned: async () => emptyPage,
    ...overrides,
  };
}

describe('community screens', () => {
  it('says the feature is not connected while the backend module is pending', async () => {
    await renderRoutes([page('/community', <CommunityPage />)], '/community');
    expect(
      await screen.findByText(
        'This feature is not connected to the server yet. Please try again later.',
      ),
    ).toBeTruthy();
  });

  it('offers a Guest only the shared tabs and an invitation to sign in', async () => {
    await renderRoutes(
      [page('/community', <CommunityPage />)],
      '/community?tab=SAVED',
      fakeAuth(),
      { community: community({}) },
    );
    expect(await screen.findByRole('tab', { name: 'Latest' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Saved' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Latest' }).ariaSelected).toBe(
      'true',
    );
    expect(
      screen.getByRole('heading', { name: 'Sign in to join the discussion' }),
    ).toBeTruthy();
  });

  it('locks video on a plan without VIDEO_POST and shows MSG32 from the server', async () => {
    const user = userEvent.setup();
    await renderRoutes(
      [page('/community/new', <PostEditorPage />)],
      '/community/new',
      signedIn(free),
      {
        community: community({
          create: async () => {
            throw new ServiceError('refused', 'HTTP_ERROR', 400, {
              status: 400,
              code: 'MEDIA_INVALID',
              messageCode: 'MSG32',
              messageArgs: ['5 MB'],
              fieldErrors: {},
            });
          },
        }),
      },
    );
    expect(
      (await screen.findByRole('link', { name: /Add video/ })).getAttribute(
        'href',
      ),
    ).toBe('/subscription');
    await user.type(screen.getByLabelText('Title'), 'A valid title');
    await user.type(screen.getByLabelText('Content'), 'Some text');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(
      await screen.findByText(
        'File type or size is not supported (maximum 5 MB).',
      ),
    ).toBeTruthy();
  });
});
