import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initScrollRegionFocus } from './lib/a11y';
import { initPwa } from './lib/pwa';
import './fonts';
import './styles.css';

initPwa();
initScrollRegionFocus();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
