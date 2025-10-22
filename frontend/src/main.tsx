import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import Routes from './pages';

import './_index.scss';
import { ThemeProvider } from './theme/ThemeProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <Routes />
    </ThemeProvider>
  </StrictMode>
);
