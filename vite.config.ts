import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const excludeDevelopmentModules: Plugin = {
  name: 'exclude-development-modules',
  apply: 'build',
  generateBundle() {
    for (const id of this.getModuleIds()) {
      if (id.replaceAll('\\', '/').includes('/src/dev/')) {
        this.error(
          'Development-only modules must not be included in a production build: ' +
            id,
        );
      }
    }
  },
};
export default defineConfig({
  plugins: [react(), tailwindcss(), excludeDevelopmentModules],
});
