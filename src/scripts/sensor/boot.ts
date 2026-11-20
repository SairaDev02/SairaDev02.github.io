// Entry for the sensor view: the frame's box is reserved by CSS, so this only loads the
// scene chunk through the shared lazy loader. The scene is three.js and is never part of
// the page's initial JS.
import { whenDue } from '../lazy';

const frame = document.querySelector<HTMLElement>('[data-sensor-frame]');
if (frame) whenDue(frame, () => void import('./scene').then((m) => m.mountSensor(frame)));
