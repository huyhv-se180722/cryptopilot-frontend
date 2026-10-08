import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import './styles/index.css';
import { readEnvironment } from './app/config/env';
import { createServices } from './app/providers/create-services';
import { AppProviders } from './app/providers/AppProviders';
import { router } from './app/router/router';
import { ErrorState } from './components/feedback/States';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element is missing.');
const root = createRoot(rootElement);

async function bootstrap() {
  try {
    const services = await createServices(readEnvironment());
    root.render(
      <StrictMode>
        <AppProviders services={services}>
          <RouterProvider router={router} />
        </AppProviders>
      </StrictMode>,
    );
  } catch {
    root.render(
      <ErrorState
        title="Configuration error"
        message="Check the public environment variables and restart the application."
      />,
    );
  }
}
void bootstrap();
