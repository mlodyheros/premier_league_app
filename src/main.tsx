import { render } from 'preact';
import '@fontsource-variable/inter';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles/main.css';
import { App } from './App';
import { loadDataset } from './data/store';

loadDataset();
render(<App />, document.getElementById('app')!);
