import { render as mount } from 'preact';
import { App } from './app/App';
import './app/app.css';
import { loadCoreFonts } from './fonts';

const ready = loadCoreFonts();
mount(<App ready={ready} />, document.getElementById('app')!);
