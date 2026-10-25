import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initScrollRegionFocus } from './lib/a11y';
import { initPwa } from './lib/pwa';
import './fonts';
import './tokens.css';
import './styles.css';
import './theme-2026.css';

initPwa();
initScrollRegionFocus();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
