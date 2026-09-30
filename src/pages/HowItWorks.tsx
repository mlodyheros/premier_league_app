import { useDataset } from '../data/store';

/** Placeholder until phase 3; already shows the real, exported figures. */
export function HowItWorks() {
  const { meta } = useDataset();
  const m = meta.model;
  return (
    <section class="prose">
      <h1>How it works</h1>
      <p>
        Player data and model estimates come from{' '}
        <a href={meta.source.url} target="_blank" rel="noopener">
          {meta.source.name}
        </a>
        , exported on {meta.dataDate} (after gameweek {meta.gameweek} of {meta.season}).
      </p>
      <p>
        The model is a {m.kind.toLowerCase()}, using {m.features} features. Every player is scored {m.scoring}.
        In 5-fold cross-validation it explains {Math.round(m.cvR2Log * 100)}% of the variance in log value
        (R² {m.cvR2Log}).
      </p>
      <p class="muted">The full explanation arrives in phase 3.</p>
    </section>
  );
}
