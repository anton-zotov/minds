import { createRoot } from 'react-dom/client';
import { embeddingView, EmbeddingFixture } from './embedding-fixture';
import { App } from './App';
import '../../../packages/inspector/src/styles.css';
import './styles.css';
const root = createRoot(document.getElementById('root')!);
const embed = new URLSearchParams(location.search).get('embed');
if (embed) {
  const view = await embeddingView();
  if (embed === 'unsupported') Object.assign(view, { schemaVersion: 99 });
  if (embed === 'empty') view.minds = [];
  root.render(<EmbeddingFixture view={view} />);
} else root.render(<App />);
