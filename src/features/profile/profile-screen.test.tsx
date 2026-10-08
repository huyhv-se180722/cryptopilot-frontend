// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfilePage } from '../../pages/trader/ProfilePage';
import { ServiceError } from '../../services/api/errors';
import type { ProfileService } from '../../services/api/contracts';
import { createPendingProfileService } from '../../services/api/profile';
import type { RiskProfile, UserProfile } from '../../types/domain';
import { fakeAuth, page, renderRoutes } from '../../test/render';

// jsdom has no modal dialog; the component only needs open/close.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const PROFILE: UserProfile = {
  email: 'trader@example.test',
  displayName: 'Test Trader',
  avatarUrl: null,
  defaultCapital: '1000',
  defaultRiskPercent: '0.5',
  tradingStyle: 'SWING',
  riskProfile: 'CONSERVATIVE',
  notifyEmail: true,
  notifyPush: false,
};

function refusal(code: string, messageCode: string) {
  return new ServiceError('refused', 'HTTP_ERROR', 400, {
    status: 400,
    code,
    messageCode,
    messageArgs: [],
    fieldErrors: {},
  });
}

function fakeProfile(overrides: Partial<ProfileService> = {}) {
  let riskProfile: RiskProfile = 'CONSERVATIVE';
  const service = {
    get: vi.fn(async () => ({ ...PROFILE, riskProfile })),
    update: vi.fn(async () => undefined),
    updateNotifications: vi.fn(async () => undefined),
    getRiskProfile: vi.fn(async () => ({
      riskProfile,
      riskPerTradePercent: '0.5',
      maxFuturesLeverage: 3,
      maxTotalOpenRiskPercent: '2',
    })),
    chooseRiskProfile: vi.fn(async (profile: RiskProfile) => {
      riskProfile = profile;
    }),
    getQuestionnaire: vi.fn(async () => [
      {
        code: 'Q1',
        group: 'CAPACITY' as const,
        text: 'Capacity question',
        options: [
          { code: 'A', text: 'Answer A' },
          { code: 'B', text: 'Answer B' },
        ],
      },
      {
        code: 'Q2',
        group: 'ATTITUDE' as const,
        text: 'Attitude question',
        options: [{ code: 'C', text: 'Answer C' }],
      },
    ]),
    suggestRiskProfile: vi.fn(async () => ({
      capacityScore: 6,
      attitudeScore: 7,
      suggestedProfile: 'BALANCED' as const,
    })),
    ...overrides,
  };
  return service;
}

async function open(
  profile: ProfileService,
  path = '/profile',
  auth = fakeAuth(),
) {
  await renderRoutes([page('/profile', <ProfilePage />)], path, auth, {
    profile,
  });
}

describe('SCR-07 Profile tab', () => {
  it('checks the fields, then saves a full replacement and shows MSG14', async () => {
    const profile = fakeProfile();
    await open(profile);
    const name = await screen.findByLabelText('Display name');
    expect((name as HTMLInputElement).value).toBe('Test Trader');

    await userEvent.clear(name);
    await userEvent.type(name, 'A');
    const risk = screen.getByLabelText('Default risk per trade (%)');
    await userEvent.clear(risk);
    await userEvent.type(risk, '12');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByText('The display name field is required.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Default risk per trade must be between 0.1 and 10.'),
    ).toBeTruthy();
    expect(profile.update).not.toHaveBeenCalled();

    const readsBefore = vi.mocked(profile.get).mock.calls.length;
    await userEvent.type(name, 'lex');
    await userEvent.clear(risk);
    await userEvent.clear(screen.getByLabelText('Default capital (USDT)'));
    await userEvent.selectOptions(
      screen.getByLabelText('Trading style'),
      'DAY',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Saved successfully.')).toBeTruthy();
    expect(profile.update).toHaveBeenCalledWith({
      displayName: 'Alex',
      defaultCapital: null,
      defaultRiskPercent: null,
      tradingStyle: 'DAY',
    });
    await waitFor(() =>
      expect(vi.mocked(profile.get).mock.calls.length).toBeGreaterThan(
        readsBefore,
      ),
    );
  });

  it('shows the risk parameters with two decimals (CR-02)', async () => {
    await open(fakeProfile());
    expect(await screen.findByText('0.50 %')).toBeTruthy();
    expect(screen.getByText('2.00 %')).toBeTruthy();
  });

  it('asks MSG48 before saving AGGRESSIVE and then confirms it', async () => {
    const profile = fakeProfile();
    await open(profile);
    await userEvent.click(
      await screen.findByRole('radio', { name: 'Aggressive' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Save risk profile' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Aggressive risk profile',
    });
    expect(within(dialog).getByText(/can lead to large losses/)).toBeTruthy();
    expect(profile.chooseRiskProfile).not.toHaveBeenCalled();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Use Aggressive' }),
    );
    await waitFor(() =>
      expect(profile.chooseRiskProfile).toHaveBeenCalledWith(
        'AGGRESSIVE',
        true,
      ),
    );
    expect(await screen.findByText('Saved successfully.')).toBeTruthy();
  });

  it('shows the questionnaire suggestion without saving it', async () => {
    const profile = fakeProfile();
    await open(profile);
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Take the risk questionnaire',
      }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Risk questionnaire',
    });
    const submit = within(dialog).getByRole('button', {
      name: 'See suggestion',
    });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(await within(dialog).findByLabelText('Answer B'));
    await userEvent.click(within(dialog).getByLabelText('Answer C'));
    await userEvent.click(submit);
    expect(profile.suggestRiskProfile).toHaveBeenCalledWith({
      Q1: 'B',
      Q2: 'C',
    });
    expect(await within(dialog).findByText('Balanced')).toBeTruthy();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Select this profile' }),
    );
    expect(
      screen
        .getByRole('radio', { name: 'Balanced' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(profile.chooseRiskProfile).not.toHaveBeenCalled();
  });

  it('shows the pending state while the API is not configured', async () => {
    await open(createPendingProfileService());
    // The Profile and Notifications tabs both need the profile.
    const shown = await screen.findByRole('alert');
    expect(shown.textContent).toContain(
      'This feature is not connected to the server yet. Please try again later.',
    );
  });
});

describe('SCR-07 Security and Notifications tabs', () => {
  it('shows MSG08 under the current password and keeps the form', async () => {
    const auth = fakeAuth({
      changePassword: vi.fn(async () => {
        throw refusal('CURRENT_PASSWORD_INCORRECT', 'MSG08');
      }),
    });
    await open(fakeProfile(), '/profile?tab=security', auth);
    await userEvent.type(
      await screen.findByLabelText('Current password'),
      'Wrong-pass1',
    );
    await userEvent.type(screen.getByLabelText('New password'), 'New-pass12');
    await userEvent.type(
      screen.getByLabelText('Confirm password'),
      'New-pass12',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Change password' }),
    );
    expect(
      await screen.findByText(
        'Incorrect email or password. Please check again.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Current password').getAttribute('aria-invalid'),
    ).toBe('true');
  });

  it('saves the email and push switches', async () => {
    const profile = fakeProfile();
    await open(profile, '/profile?tab=notifications');
    await userEvent.click(
      await screen.findByRole('switch', { name: /Push notifications/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(profile.updateNotifications).toHaveBeenCalledWith({
        email: true,
        push: true,
      }),
    );
    expect(
      (screen.getByRole('switch', { name: /In-app/ }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });
});
