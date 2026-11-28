import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/nunito/latin-500.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import { startSoundLife } from '@riddle/fx';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { reloadSettings } from '@riddle/fx';
import { App } from './App';
import { restoreBackup } from './backup';
import './index.css';
import { startNativeFeel } from './nativeFeel';
import { lockZoom, registerPwa } from './pwa/register';
import { startTextSize } from './textSize';

lockZoom();
registerPwa();
startNativeFeel();
startTextSize();
startSoundLife();

const draw = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

// In the app, progress lost from the web view's storage comes back from the app's own copy before the first
// screen (backup.ts). On the website, and on a usual app start, this draws at once, as before.
const restoring = restoreBackup();
if (restoring) {
  void restoring.then((back) => {
    if (back.includes('riddle-games:settings:v1')) reloadSettings();
    draw();
  });
} else {
  draw();
}
