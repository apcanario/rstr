import { render as mount } from 'preact';
import { App } from './app/App';
import './app/app.css';
import { loadCoreFonts } from './fonts';

// spec 6: the service worker caches every font file fetched, so a pairing used once works offline
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);

const ready = loadCoreFonts();
mount(<App ready={ready} />, document.getElementById('app')!);
