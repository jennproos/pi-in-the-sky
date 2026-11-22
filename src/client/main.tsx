import '@fontsource-variable/atkinson-hyperlegible-next';
import '@fontsource-variable/fraunces/full.css';
import './styles/tokens.css';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, lastTheme } from './lib/theme';

// Colors for the loading screen; the saved theme takes over once settings arrive.
applyTheme(lastTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
