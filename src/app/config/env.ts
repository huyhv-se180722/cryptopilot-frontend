function readUrl(
  name: string,
  value: string | undefined,
  protocols: readonly string[],
): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  const url = new URL(trimmed);
  if (
    !protocols.includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      name +
        ' must be an absolute URL without credentials, query parameters, or fragment.',
    );
  }
  if (import.meta.env.PROD && !['https:', 'wss:'].includes(url.protocol)) {
    throw new Error(name + ' must use a secure protocol in production.');
  }
  return trimmed;
}

export function readEnvironment() {
  return {
    apiBaseUrl: readUrl(
      'VITE_API_BASE_URL',
      import.meta.env.VITE_API_BASE_URL,
      ['http:', 'https:'],
    ),
    wsUrl: readUrl('VITE_WS_URL', import.meta.env.VITE_WS_URL, ['ws:', 'wss:']),
    useDevFixtures:
      import.meta.env.DEV &&
      import.meta.env.VITE_ENABLE_DEV_FIXTURES === 'true',
  };
}
export type Environment = ReturnType<typeof readEnvironment>;
