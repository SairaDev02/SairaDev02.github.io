// Entry for the background field: loads the field chunk when the sensor view's chunk is
// due (lazy.ts whenDue: idle after the window's load event, or once the view is within a
// viewport of the screen), so it never arrives before the view's scene and the page's text
// and board never wait on three.js. The chunk shares its three.js with the view's. The
// canvas is fixed, so its arrival moves nothing.
import { whenDue } from '../lazy';

const frame = document.querySelector('[data-sensor-frame]');
if (frame) whenDue(frame, () => void import('./field').then((m) => m.mountField()));
