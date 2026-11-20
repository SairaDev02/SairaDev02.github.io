// Entry for the background field: loads the field chunk after the window's load event
// (lazy.ts), so the page's text and board never wait on three.js. The chunk shares its
// three.js with the sensor view's. The canvas is fixed, so its arrival moves nothing.
import { afterLoad } from '../lazy';

afterLoad(() => void import('./field').then((m) => m.mountField()));
