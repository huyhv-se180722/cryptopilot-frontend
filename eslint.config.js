import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: [
      'src/dev/**',
      'src/**/*.test.ts',
      'src/app/providers/create-services.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/dev/**', '**/fixtures/**'],
              message:
                'Development data may only enter through the service composition root or tests.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'Use a feature hook and the centralized HTTP client.',
        },
        {
          name: 'WebSocket',
          message: 'Use the realtime service through a hook.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/services/**'],
              message: 'UI consumes hooks; hooks consume services.',
            },
            {
              group: ['**/dev/**', '**/fixtures/**'],
              message: 'UI must never import development fixtures.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
