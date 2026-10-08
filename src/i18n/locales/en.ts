/**
 * English interface copy (default locale, ADR-014).
 * UI strings only — never business data. MSG entries mirror the SRS message ids.
 */
export const en = {
  product: {
    name: 'CryptoPilot',
    description: 'Crypto Trading Support System',
  },
  common: {
    loading: 'Loading…',
    retry: 'Try again',
    close: 'Close',
    cancel: 'Cancel',
    confirm: 'Confirm',
    skipToContent: 'Skip to content',
    somethingWrong: 'Something went wrong',
    returnHome: 'Return home',
    search: 'Search…',
    noRecords: 'No records available.',
  },
  messages: {
    MSG10: 'Your account has been {status}. Please contact support.',
    MSG27:
      'You have reached the limit of {max} {items} of the {plan} plan. Upgrade to increase the limit?',
    MSG29:
      'This feature is available on the {plan} plan or higher. View plans?',
    MSG41: 'No results found.',
    MSG42:
      'Information on CryptoPilot is for reference and education only and is not investment advice.',
    MSG43: 'Something went wrong. Please try again. (Ref: {code})',
    MSG44: 'Your session has expired. Please log in again.',
  },
  integration: {
    fixturesTitle: 'Development fixtures enabled',
    fixturesBody: 'Isolated test data; no live backend connection.',
    pendingTitle: 'Backend integration pending',
    pendingBody:
      'Routes and services are prepared. Live data and sign in are not connected.',
  },
  bootstrap: {
    configErrorTitle: 'Configuration error',
    configErrorBody:
      'Check the public environment variables and restart the application.',
  },
  errors: {
    routeLoad: 'This route could not be loaded.',
    render: 'The application could not render this view.',
    notFoundTitle: 'Page not found',
    notFoundBody: 'This route does not exist.',
  },
  access: {
    restoring: 'Restoring session…',
    unavailable:
      'Session restoration is unavailable. Authentication integration may be pending.',
    deniedTitle: 'Access denied',
    deniedBody: 'Your account does not have access to this area.',
  },
  placeholder: {
    badge: 'Planned screen',
    title: 'Screen in development',
    body: 'This route is reserved. Its screen and backend integration are delivered in a dedicated feature branch.',
  },
  theme: {
    label: 'Appearance',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  },
} as const;

type Widen<T> = T extends string
  ? string
  : { readonly [K in keyof T]: Widen<T[K]> };

/** Shape every locale must satisfy (values widened to string). */
export type Copy = Widen<typeof en>;
