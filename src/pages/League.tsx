import { useEffect, useState } from 'preact/hooks';
import { notifyShare, toast } from '../components/Toast';
import { t, tj } from '../i18n';
import { formatDate } from '../lib/format';
import { addFriend, dayScore, decodeCard, friends, leagueLink, myCard, myName, NAME_MAX, removeFriend, setMyName, type Card } from '../lib/friends';
import { todayKey } from '../lib/rng';
import { shareText } from '../lib/share';
import { routeParam } from '../router';

/** Friends league: results travel in links, so there are no accounts and no server. */
export function League() {
  const [day] = useState(todayKey);
  const [name, setName] = useState(myName);
  const [list, setList] = useState<Card[]>(friends);

  // "#/league?add=<code>": a friend's link. Add them, then tidy the address.
  useEffect(() => {
    const code = routeParam('add');
    if (!code) return;
    const card = decodeCard(code);
    if (card && card.n !== myName()) {
      setList(addFriend(card));
      toast(t('league.added', { name: card.n }));
    } else if (!card) {
      toast(t('league.badCode'));
    }
    history.replaceState(null, '', `${location.pathname}${location.search}#/league`);
  }, []);

  const me = myCard(day, name);
  const rows = [{ card: me, you: true }, ...list.map((card) => ({ card, you: false }))]
    .map((r) => ({ ...r, score: dayScore(r.card, day) }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  async function share() {
    if (!name.trim()) {
      toast(t('league.needName'));
      return;
    }
    const text = `${t('league.invite', { name: name.trim() })}\n${leagueLink(myCard(day, name.trim()))}`;
    notifyShare(await shareText(text));
  }

  return (
    <section class="league-page">
      <header>
        <h1>{t('league.title')}</h1>
        <p class="lede">{t('league.lede')}</p>
      </header>

      <div class="league-me">
        <label>
          {t('league.name')}
          <input
            type="text"
            maxLength={NAME_MAX}
            value={name}
            placeholder={t('league.namePlaceholder')}
            onInput={(e) => {
              const v = (e.target as HTMLInputElement).value;
              setName(v);
              setMyName(v);
            }}
          />
        </label>
        <button class="btn btn--primary" onClick={share}>
          {t('league.share')}
        </button>
      </div>
      <p class="mode-help">{t('league.how')}</p>

      <div class="table-scroll">
        <table class="league-table">
          <caption>{tj('league.caption', { day: <b>{formatDate(day)}</b> })}</caption>
          <thead>
            <tr>
              <th class="l">{t('league.col.who')}</th>
              <th title={t('league.col.score')}>{t('league.col.scoreShort')}</th>
              <th title={t('game.guess.title')}>🔍</th>
              <th title={t('game.beat.title')}>🤖</th>
              <th title={t('game.price.title')}>🏷️</th>
              <th title={t('game.road.title')}>💯</th>
              <th title={t('game.hl.title')}>↕️</th>
              <th title={t('game.transfer.title')}>🔁</th>
              <th aria-label={t('league.col.actions')} />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ card, you, score }) => {
              const today = card.d === day;
              return (
                <tr class={you ? 'you' : ''}>
                  <td class="l">
                    <b>{you ? (name.trim() || t('league.you')) : card.n}</b>
                    {!today && <small>{t('league.from', { date: formatDate(card.d) })}</small>}
                  </td>
                  <td>
                    <b>{score ?? '–'}</b>
                  </td>
                  <td>{today ? (card.g ?? '–') : '–'}</td>
                  <td>{today ? (card.b ?? '–') : '–'}</td>
                  <td>{today ? (card.p?.split('/')[0] ?? '–') : '–'}</td>
                  <td>{card.r ?? '–'}</td>
                  <td>{card.h ?? '–'}</td>
                  <td>{card.t === null ? '–' : card.t > 0 ? `+${card.t}` : card.t}</td>
                  <td>
                    {!you && (
                      <button
                        class="league-table__remove"
                        aria-label={t('league.remove', { name: card.n })}
                        title={t('league.remove', { name: card.n })}
                        onClick={() => setList(removeFriend(card.n))}
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <p class="mode-help">{t('league.empty')}</p>}
    </section>
  );
}
