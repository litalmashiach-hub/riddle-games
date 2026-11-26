import './shoot/boot'; // TEST ONLY: store screenshots
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/nunito/latin-500.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import { startSoundLife } from '@riddle/fx';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { startNativeFeel } from './nativeFeel';
import { lockZoom, registerPwa } from './pwa/register';

lockZoom();
registerPwa();
startNativeFeel();
startSoundLife();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
