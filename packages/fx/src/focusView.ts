import * as THREE from 'three';

/*
 * The whole-scene view that FocusCam glides back to after a fail scene's zoom.
 *
 * It is kept here, by the shell's controls, and not inside the FocusCam that zoomed in: a level may
 * mount its FocusCam only while there is a loss to show, and drop it at the very moment the player
 * undoes that loss. The view then has to outlive the component, or the camera stays zoomed in for
 * the rest of the level.
 */

export interface View {
  target: THREE.Vector3;
  pos: THREE.Vector3;
}
export interface Cam {
  position: THREE.Vector3;
}
export interface Controls {
  target: THREE.Vector3;
}

const homes = new WeakMap<Controls, View>();
/** How many FocusCams are zooming in on these controls right now. */
const zooming = new WeakMap<Controls, number>();

/** Closer than this, the glide back ends and the camera is put exactly on the saved view. */
const ARRIVED = 0.02;

/** Remember the whole-scene view before the first zoom. A second zoom on top of it keeps the first view. */
export function holdView(controls: Controls, camera: Cam): View {
  let home = homes.get(controls);
  if (!home) {
    home = { target: controls.target.clone(), pos: camera.position.clone() };
    homes.set(controls, home);
  }
  return home;
}

/** The view to go back to, if a zoom is still to be undone. */
export const heldView = (controls: Controls) => homes.get(controls) ?? null;

export function zoomStarted(controls: Controls) {
  zooming.set(controls, (zooming.get(controls) ?? 0) + 1);
}
export function zoomEnded(controls: Controls) {
  zooming.set(controls, Math.max(0, (zooming.get(controls) ?? 0) - 1));
}
export const isZooming = (controls: Controls) => (zooming.get(controls) ?? 0) > 0;

/**
 * One step of the glide back; `k` is the share of the remaining way to cover (0..1).
 * Returns true once there is nothing left to do: the camera then sits exactly on the saved view, and the view is forgotten.
 */
export function glideBack(controls: Controls, camera: Cam, k: number): boolean {
  const home = homes.get(controls);
  if (!home) return true;
  controls.target.lerp(home.target, k);
  camera.position.lerp(home.pos, k);
  if (camera.position.distanceTo(home.pos) >= ARRIVED) return false;
  controls.target.copy(home.target);
  camera.position.copy(home.pos);
  homes.delete(controls);
  return true;
}

type Schedule = (step: (nowMs: number) => void) => unknown;

/**
 * Finish the glide back without a FocusCam, frame by frame, for one that left the scene while zoomed in.
 * It stands aside as soon as another FocusCam zooms in (the saved view stays, for that one's way back).
 */
export function finishGlide(
  controls: Controls,
  camera: Cam,
  speed: number,
  schedule: Schedule = (step) => requestAnimationFrame(step),
) {
  let last: number | null = null;
  const step = (now: number) => {
    if (isZooming(controls) || !homes.has(controls)) return;
    // No cap on a long frame: the step is a share of the way left, so a slow frame only covers more of it.
    const dt = last == null ? 1 / 60 : Math.max(0, (now - last) / 1000);
    last = now;
    if (!glideBack(controls, camera, 1 - Math.exp(-speed * dt))) schedule(step);
  };
  schedule(step);
}
