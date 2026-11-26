// Apply the saved theme before first paint (ThemeProvider takes over after mount). A file of its own, loaded
// synchronously from <head>, so the Content-Security-Policy needs no inline script (T-095). The key is
// THEME_STORAGE_KEY of src/app/theme/theme.ts.
/* global document, localStorage, matchMedia */
(function () {
  var theme = 'light';
  try {
    var saved = localStorage.getItem('cp-theme');
    if (saved === 'dark') theme = 'dark';
    else if (saved === 'system')
      theme = matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  } catch {
    // Storage can be blocked (private mode, policy): keep the light theme.
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
