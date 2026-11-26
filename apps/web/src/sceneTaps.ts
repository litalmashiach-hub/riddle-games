import { events as createPointerEvents, type RootStore } from '@react-three/fiber';
import { APP_SHELL } from './appShell';
import { sceneTakesTaps, tapFeedback } from './haptics';

/*
 * The touch response of the 3D scene (see haptics.ts). Kept apart from haptics.ts because it needs the 3D
 * layer, which only the play screen loads: haptics.ts itself starts with the level map.
 */

let missed = false;

/**
 * For the level's <Canvas>: its usual pointer events, plus a tick when a tap lands on something in the scene
 * that listens for taps. A tap on plain scenery, a drag of the camera, and a tap while the scene is busy with
 * an animation (when it takes none) give no tick. On the website this is empty and the canvas is as it was.
 */
export const sceneTaps: { events?: typeof createPointerEvents; onPointerMissed?: () => void } = APP_SHELL
  ? {
      onPointerMissed: () => {
        missed = true;
      },
      events: (store: RootStore) => {
        const manager = createPointerEvents(store);
        const click = manager.handlers!.onClick;
        return {
          ...manager,
          handlers: {
            ...manager.handlers!,
            onClick: (event: Event) => {
              const e = event as MouseEvent;
              // The same test as the 3D layer's own: a finger that moved was turning the camera, not tapping.
              const [x, y] = store.getState().internal.initialClick;
              const still = Math.hypot(e.offsetX - x, e.offsetY - y) <= 2;
              const open = sceneTakesTaps();
              missed = false;
              click(event);
              if (still && open && !missed) tapFeedback();
            },
          },
        };
      },
    }
  : {};
