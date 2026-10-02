import { useMemo, useState } from 'preact/hooks';
import { cardFooter } from '../lib/shareSpecs';
import { openShare } from '../components/ShareSheet';
import { useRevealWhen } from '../hooks/useRevealWhen';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { useHistory, historyError } from '../data/history';
import { useDataset } from '../data/store';
import { valueSource, type ValueSource } from '../data/valueSource';
import { t, tj } from '../i18n';
import { posLabel } from '../i18n/labels';
import { formatDate, formatEur, formatPct } from '../lib/format';
import { marketRound } from '../lib/dailyRounds';
import { QUIZ_ROUNDS, weeklyMoves, type Move } from '../lib/market';
import { buzz, celebrate } from '../lib/motion';
import { dayNumber, todayKey } from '../lib/rng';
import { shareUrl } from '../lib/share';
import { readJson, writeJson } from '../lib/storage';
import { href } from '../router';

const quizKey = (day: string) => `market:quiz:${day}`;

function MoveRow({ m }: { m: Move }) {
  const { meta } = useDataset();
  return (
    <li class="move">
      <Avatar player={m.player} size={30} />
      <span class="move__name">
        {m.player.name}
        <small>
          {meta.clubs[m.player.club].short} · {posLabel(m.player.pos)} · {formatEur(m.from)} → {formatEur(m.to)}
        </small>
      </span>
      <b class={`move__pct ${m.change > 0 ? 'up' : 'down'}`}>{formatPct(m.change)}</b>
    </li>
  );
}

/** The week's biggest value changes, and a daily quiz on them. */
export function Market() {
  const { players } = useDataset();
  const h = useHistory();
  const chosen = valueSource.value;
  const [day] = useState(todayKey);

  const tm = useMemo(() => (h ? weeklyMoves(h, players, 'tm') : null), [h, players]);
  const model = useMemo(() => (h ? weeklyMoves(h, players, 'model') : null), [h, players]);

  if (historyError.value) {
    return (
      <section class="market">
        <p class="notice-inline">{t('market.error')}</p>
      </section>
    );
  }
  if (!h) {
    return (
      <section class="market">
        <div class="skeleton" aria-busy="true" aria-label={t('app.loading')}>
          <span class="skeleton__line skeleton__line--title" />
          <span class="skeleton__line" />
        </div>
      </section>
    );
  }

  // Transfermarkt revises its values every few weeks; most weeks only the model moves.
  const tmStill = !tm || tm.all.length === 0;
  const source: ValueSource = chosen === 'tm' && tmStill ? 'model' : chosen;
  const moves = source === 'tm' ? tm : model;

  return (
    <section class="market">
      <header class="market__head">
        <h1>{t('market.title')}</h1>
        {moves ? (
          <p class="lede">
            {tj('market.lede', {
              from: <b>{formatDate(moves.from)}</b>,
              to: <b>{formatDate(moves.to)}</b>,
              count: moves.all.length,
              source: <b>{t(`market.source.${source}`)}</b>,
            })}
          </p>
        ) : (
          <p class="lede">{t('market.firstWeek')}</p>
        )}
        {chosen === 'tm' && tmStill && moves && <p class="notice-inline">{t('market.tmStill')}</p>}
      </header>

      {moves && (
        <>
          <div class="market__cols">
            <section>
              <h2 class="section-title">
                <Icon name="trending-up" /> {t('market.risers')}
              </h2>
              <ol class="moves">
                {moves.risers.map((m) => (
                  <MoveRow m={m} />
                ))}
              </ol>
            </section>
            <section>
              <h2 class="section-title">
                <Icon name="trending-down" /> {t('market.fallers')}
              </h2>
              <ol class="moves">
                {moves.fallers.map((m) => (
                  <MoveRow m={m} />
                ))}
              </ol>
            </section>
          </div>
          <Quiz day={day} />
        </>
      )}

      <p class="market__foot">
        {t('market.foot')} <a href={href('stats')}>{t('market.toPlayers')}</a>
      </p>
    </section>
  );
}

/** "Who gained more this week?": five pairs, the same for everyone today. */
function Quiz({ day }: { day: string }) {
  const { players, schedule } = useDataset();
  const h = useHistory();
  const pairs = useMemo(() => marketRound(players, schedule, h, day) ?? [], [players, schedule, h, day]);
  const [answers, setAnswers] = useState<number[]>(() => readJson<number[]>(quizKey(day)) ?? []);
  const endRef = useRevealWhen(pairs.length > 0 && answers.length >= pairs.length);
  if (pairs.length < QUIZ_ROUNDS) return null;
  const index = Math.min(answers.length, pairs.length - 1);
  const done = answers.length >= pairs.length;
  const right = (i: number) => {
    const [a, b] = pairs[i];
    return answers[i] === (a.change > b.change ? 0 : 1);
  };
  const score = answers.filter((_, i) => right(i)).length;

  function answer(side: number) {
    if (done) return;
    const next = [...answers, side];
    setAnswers(next);
    writeJson(quizKey(day), next);
    const [a, b] = pairs[answers.length];
    buzz(side === (a.change > b.change ? 0 : 1) ? 'good' : 'bad');
    if (next.length === pairs.length && next.every((s, i) => s === (pairs[i][0].change > pairs[i][1].change ? 0 : 1))) {
      celebrate();
    }
  }

  function share() {
    const grid = pairs.map((_, i) => (right(i) ? '🟩' : '🟥')).join('');
    openShare(
      {
        game: t('market.quiz'),
        kicker: t('mode.daily', { n: dayNumber(day) }),
        headline: `${score}/${pairs.length}`,
        sub: t('market.title'),
        strip: pairs.map((_, i) => (right(i) ? 'good' : 'bad')),
        ...cardFooter(),
      },
      `${t('market.quizShare', { n: dayNumber(day) })} ${score}/${pairs.length}\n${grid}\n${shareUrl('market')}`,
      'pl-games-market-quiz',
    );
  }

  const last = answers.length - 1;
  const shown = done ? null : pairs[index];
  return (
    <section class="quiz">
      <h2 class="section-title">{t('market.quiz')}</h2>
      <p class="mode-help">{t('market.quizHelp')}</p>
      <ol class="progress" aria-label={t('common.rounds')}>
        {pairs.map((_, i) => (
          <li class={i < answers.length ? (right(i) ? 'ok' : 'no') : i === answers.length ? 'now' : ''} />
        ))}
      </ol>
      {last >= 0 && (
        <p class={`quiz__last ${right(last) ? 'good' : 'bad'}`} aria-live="polite">
          {right(last) ? '✓' : '✗'}{' '}
          {t('market.quizReveal', {
            a: pairs[last][0].player.short,
            ac: formatPct(pairs[last][0].change),
            b: pairs[last][1].player.short,
            bc: formatPct(pairs[last][1].change),
          })}
        </p>
      )}
      {shown ? (
        <div class="quiz__pair">
          {shown.map((m, side) => (
            <button class="quiz__pick" onClick={() => answer(side)}>
              <Avatar player={m.player} size={44} />
              <b>{m.player.name}</b>
              <small>{formatEur(m.from)}</small>
            </button>
          ))}
        </div>
      ) : (
        <div class={`end ${score >= 4 ? 'end--win' : 'end--lose'}`} ref={endRef}>
          <p class="end__title">
            {score}/{pairs.length}
          </p>
          <div class="end__actions">
            <button class="btn" onClick={share}>
              {t('common.share')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
