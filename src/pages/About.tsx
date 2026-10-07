import { analyticsAvailable } from '../lib/analytics';
import { useDataset } from '../data/store';
import { t, tj } from '../i18n';
import { formatDate } from '../lib/format';
import { href } from '../router';
import { Icon } from '../components/Icon';

const REPO = 'https://github.com/mlodyheros/premier_league_app';

/**
 * A pre-filled bug report on GitHub: the page and the data date, nothing about
 * the player.
 */
export function reportUrl(page = location.hash || '#/'): string {
  const body = `${t('about.issueBody')}\n\n---\n${t('about.issuePage')}: ${page}`;
  return `${REPO}/issues/new?title=${encodeURIComponent(t('about.issueTitle'))}&body=${encodeURIComponent(body)}`;
}

/** Who makes this, where the data comes from, what is kept about you, and how to get in touch. */
export function About() {
  const { meta } = useDataset();
  const link = (url: string, text: string) => (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {text}
    </a>
  );
  return (
    <section class="about">
      <h1>{t('about.title')}</h1>
      <p class="lede">{t('about.lede')}</p>

      <section>
        <h2>{t('about.data.title')}</h2>
        <ul>
          <li>{tj('about.data.values', { tm: link('https://www.transfermarkt.com', 'Transfermarkt') })}</li>
          <li>{tj('about.data.model', { repo: link('https://github.com/mlodyheros/pl-value-predictor', 'pl-value-predictor') })}</li>
          <li>{tj('about.data.stats', { fpl: link('https://fantasy.premierleague.com', 'Fantasy Premier League'), us: link('https://understat.com', 'Understat') })}</li>
          <li>{tj('about.data.ratings', { fb: link('https://www.futbin.com', 'FUTBIN') })}</li>
          <li>{t('about.data.crests')}</li>
        </ul>
        <p>{t('about.data.date', { date: formatDate(meta.dataDate) })}</p>
      </section>

      <section>
        <h2>{t('about.privacy.title')}</h2>
        <ul>
          <li>{t('about.privacy.noAccounts')}</li>
          <li>{t('about.privacy.local')}</li>
          <li>{t('about.privacy.league')}</li>
          <li>{analyticsAvailable ? t('about.privacy.analyticsOn') : t('about.privacy.analyticsOff')}</li>
        </ul>
      </section>

      <section>
        <h2>{t('about.rights.title')}</h2>
        <p>{t('about.rights.body')}</p>
        <p>{tj('about.rights.code', { license: link(`${REPO}/blob/main/LICENSE`, 'MIT'), repo: link(REPO, 'GitHub') })}</p>
      </section>

      <section class="about__contact">
        <h2>{t('about.contact.title')}</h2>
        <p>{t('about.contact.body')}</p>
        <a class="btn btn--primary" href={reportUrl()} target="_blank" rel="noopener noreferrer">
          <Icon name="alert-triangle" size={18} /> {t('about.report')}
        </a>
      </section>

      <p class="about__back">
        <a href={href('how')}>{t('about.how')}</a>
      </p>
    </section>
  );
}
