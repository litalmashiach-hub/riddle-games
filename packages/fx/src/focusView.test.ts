import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { finishGlide, glideBack, heldView, holdView, isZooming, zoomEnded, zoomStarted } from './focusView';

const rig = () => ({
  controls: { target: new THREE.Vector3(0, 0.9, -0.9) },
  camera: { position: new THREE.Vector3(0, 5.7, 9.61) },
});
const zoomIn = (r: ReturnType<typeof rig>) => {
  r.controls.target.set(-4.6, 1, 0.06);
  r.camera.position.set(-4.63, 3.88, 6.37);
};
/** Runs scheduled frames by hand, 16 ms apart. */
function frames() {
  const queue: ((now: number) => void)[] = [];
  let now = 0;
  return {
    schedule: (step: (now: number) => void) => queue.push(step),
    run(max = 2000) {
      let n = 0;
      while (queue.length && n < max) {
        now += 16;
        queue.shift()!(now);
        n++;
      }
      return n;
    },
    waiting: () => queue.length,
  };
}

describe('the view a fail zoom goes back to', () => {
  it('is the view from before the first zoom, also when a second zoom starts on top of it', () => {
    const r = rig();
    holdView(r.controls, r.camera);
    zoomIn(r);
    const again = holdView(r.controls, r.camera);
    expect(again.pos.toArray()).toEqual([0, 5.7, 9.61]);
    expect(again.target.toArray()).toEqual([0, 0.9, -0.9]);
  });

  it('glides back step by step and ends exactly on the saved view, then forgets it', () => {
    const r = rig();
    holdView(r.controls, r.camera);
    zoomIn(r);
    expect(glideBack(r.controls, r.camera, 0.1)).toBe(false);
    expect(r.camera.position.x).toBeGreaterThan(-4.63);
    let steps = 1;
    while (!glideBack(r.controls, r.camera, 0.1) && steps < 500) steps++;
    expect(steps).toBeLessThan(500);
    expect(r.camera.position.toArray()).toEqual([0, 5.7, 9.61]);
    expect(r.controls.target.toArray()).toEqual([0, 0.9, -0.9]);
    expect(heldView(r.controls)).toBeNull();
  });

  it('has nothing to do when no zoom was held', () => {
    const r = rig();
    expect(glideBack(r.controls, r.camera, 0.5)).toBe(true);
    expect(r.camera.position.toArray()).toEqual([0, 5.7, 9.61]);
  });
});

describe('a FocusCam that leaves the scene while zoomed in', () => {
  it('still brings the camera back to the whole scene', () => {
    const r = rig();
    holdView(r.controls, r.camera);
    zoomIn(r);
    const f = frames();
    finishGlide(r.controls, r.camera, 3, f.schedule);
    f.run();
    expect(f.waiting()).toBe(0);
    expect(r.camera.position.toArray()).toEqual([0, 5.7, 9.61]);
    expect(r.controls.target.toArray()).toEqual([0, 0.9, -0.9]);
    expect(heldView(r.controls)).toBeNull();
  });

  it('stands aside when the next loss zooms in, and keeps the first view for the way back', () => {
    const r = rig();
    holdView(r.controls, r.camera);
    zoomIn(r);
    const f = frames();
    finishGlide(r.controls, r.camera, 3, f.schedule);
    f.run(5);
    zoomStarted(r.controls);
    expect(isZooming(r.controls)).toBe(true);
    const at = r.camera.position.clone();
    f.run();
    expect(f.waiting()).toBe(0);
    expect(r.camera.position.toArray()).toEqual(at.toArray());
    expect(heldView(r.controls)?.pos.toArray()).toEqual([0, 5.7, 9.61]);
    zoomEnded(r.controls);
    expect(isZooming(r.controls)).toBe(false);
  });
});
