/** Country and continent names in Polish, keyed by the exported English names. */
import { lang } from './index';

const COUNTRIES_PL: Record<string, string> = {
  Albania: 'Albania',
  Algeria: 'Algieria',
  Argentina: 'Argentyna',
  Australia: 'Australia',
  Austria: 'Austria',
  Belgium: 'Belgia',
  'Bosnia-Herzegovina': 'Bośnia i Hercegowina',
  Brazil: 'Brazylia',
  Bulgaria: 'Bułgaria',
  'Burkina Faso': 'Burkina Faso',
  Cameroon: 'Kamerun',
  Canada: 'Kanada',
  Chile: 'Chile',
  Colombia: 'Kolumbia',
  "Côte d'Ivoire": 'Wybrzeże Kości Słoniowej',
  Croatia: 'Chorwacja',
  Czechia: 'Czechy',
  'DR Congo': 'DR Konga',
  Denmark: 'Dania',
  Ecuador: 'Ekwador',
  Egypt: 'Egipt',
  England: 'Anglia',
  France: 'Francja',
  Georgia: 'Gruzja',
  Germany: 'Niemcy',
  Ghana: 'Ghana',
  Greece: 'Grecja',
  Guinea: 'Gwinea',
  Haiti: 'Haiti',
  Hungary: 'Węgry',
  Iceland: 'Islandia',
  Ireland: 'Irlandia',
  Israel: 'Izrael',
  Italy: 'Włochy',
  Jamaica: 'Jamajka',
  Japan: 'Japonia',
  'South Korea': 'Korea Południowa',
  Mali: 'Mali',
  Mauritania: 'Mauretania',
  Mexico: 'Meksyk',
  Morocco: 'Maroko',
  Mozambique: 'Mozambik',
  Netherlands: 'Holandia',
  'New Zealand': 'Nowa Zelandia',
  Nigeria: 'Nigeria',
  'Northern Ireland': 'Irlandia Północna',
  Norway: 'Norwegia',
  Paraguay: 'Paragwaj',
  Poland: 'Polska',
  Portugal: 'Portugalia',
  Scotland: 'Szkocja',
  Senegal: 'Senegal',
  Serbia: 'Serbia',
  Slovakia: 'Słowacja',
  Slovenia: 'Słowenia',
  Spain: 'Hiszpania',
  Sweden: 'Szwecja',
  Switzerland: 'Szwajcaria',
  Gambia: 'Gambia',
  Türkiye: 'Turcja',
  Ukraine: 'Ukraina',
  'United States': 'Stany Zjednoczone',
  Uruguay: 'Urugwaj',
  Uzbekistan: 'Uzbekistan',
  Wales: 'Walia',
};

const CONTINENTS_PL: Record<string, string> = {
  Europe: 'Europa',
  Africa: 'Afryka',
  Asia: 'Azja',
  'South America': 'Ameryka Południowa',
  'North & Central America': 'Ameryka Północna i Środkowa',
  Oceania: 'Oceania',
};

export function countryName(nat: string): string {
  return lang.value === 'pl' ? (COUNTRIES_PL[nat] ?? nat) : nat;
}

export function continentName(continent: string): string {
  return lang.value === 'pl' ? (CONTINENTS_PL[continent] ?? continent) : continent;
}

/** For tests: every exported nationality needs a Polish name. */
export function missingPolishCountries(nats: Iterable<string>): string[] {
  return [...new Set(nats)].filter((n) => !(n in COUNTRIES_PL));
}
