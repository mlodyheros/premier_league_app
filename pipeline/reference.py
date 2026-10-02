"""Static reference data the pl-value dataset does not carry.

Hand-written, not fetched: club colours (no logos), and a country -> flag /
continent mapping used for flag emoji and the "same continent" hint.
"""

# Keyed on pl-value's `club_code`. Colours are plain hex values chosen to evoke
# each club's kit; they are not official brand assets.
CLUBS = {
    "ARS": {"name": "Arsenal", "short": "Arsenal", "primary": "#EF0107", "secondary": "#FFFFFF"},
    "AVL": {"name": "Aston Villa", "short": "Villa", "primary": "#670E36", "secondary": "#95BFE5"},
    "BOU": {"name": "AFC Bournemouth", "short": "Bournemouth", "primary": "#DA291C", "secondary": "#111111"},
    "BRE": {"name": "Brentford", "short": "Brentford", "primary": "#E30613", "secondary": "#FFFFFF"},
    "BHA": {"name": "Brighton & Hove Albion", "short": "Brighton", "primary": "#0057B8", "secondary": "#FFFFFF"},
    "CHE": {"name": "Chelsea", "short": "Chelsea", "primary": "#034694", "secondary": "#FFFFFF"},
    "COV": {"name": "Coventry City", "short": "Coventry", "primary": "#6EB6E6", "secondary": "#0B2240"},
    "CRY": {"name": "Crystal Palace", "short": "Palace", "primary": "#1B458F", "secondary": "#C4122E"},
    "EVE": {"name": "Everton", "short": "Everton", "primary": "#003399", "secondary": "#FFFFFF"},
    "FUL": {"name": "Fulham", "short": "Fulham", "primary": "#F5F5F5", "secondary": "#111111"},
    "HUL": {"name": "Hull City", "short": "Hull", "primary": "#F5A12D", "secondary": "#111111"},
    "IPS": {"name": "Ipswich Town", "short": "Ipswich", "primary": "#0044A9", "secondary": "#FFFFFF"},
    "LEE": {"name": "Leeds United", "short": "Leeds", "primary": "#F5F5F5", "secondary": "#1D428A"},
    "LIV": {"name": "Liverpool", "short": "Liverpool", "primary": "#C8102E", "secondary": "#F6EB61"},
    "MCI": {"name": "Manchester City", "short": "Man City", "primary": "#6CABDD", "secondary": "#1C2C5B"},
    "MUN": {"name": "Manchester United", "short": "Man Utd", "primary": "#DA291C", "secondary": "#FBE122"},
    "NEW": {"name": "Newcastle United", "short": "Newcastle", "primary": "#241F20", "secondary": "#FFFFFF"},
    "NFO": {"name": "Nottingham Forest", "short": "Forest", "primary": "#DD0000", "secondary": "#FFFFFF"},
    "SUN": {"name": "Sunderland", "short": "Sunderland", "primary": "#EB172B", "secondary": "#FFFFFF"},
    "TOT": {"name": "Tottenham Hotspur", "short": "Spurs", "primary": "#F5F5F5", "secondary": "#132257"},
}

# pl-value position -> (short code, group). Wingers count as forwards, as on
# Transfermarkt, where they sit under "Attack".
POSITIONS = {
    "Goalkeeper": ("GK", "GK"),
    "Centre-Back": ("CB", "DEF"),
    "Right-Back": ("RB", "DEF"),
    "Left-Back": ("LB", "DEF"),
    "Defensive Midfield": ("DM", "MID"),
    "Central Midfield": ("CM", "MID"),
    "Attacking Midfield": ("AM", "MID"),
    "Right Midfield": ("RM", "MID"),
    "Left Midfield": ("LM", "MID"),
    "Right Winger": ("RW", "FWD"),
    "Left Winger": ("LW", "FWD"),
    "Centre-Forward": ("ST", "FWD"),
}

EUROPE, AFRICA, ASIA = "Europe", "Africa", "Asia"
S_AMERICA, N_AMERICA, OCEANIA = "South America", "North & Central America", "Oceania"

_ENGLAND = "\U0001F3F4\U000E0067\U000E0062\U000E0065\U000E006E\U000E0067\U000E007F"
_SCOTLAND = "\U0001F3F4\U000E0067\U000E0062\U000E0073\U000E0063\U000E0074\U000E007F"
_WALES = "\U0001F3F4\U000E0067\U000E0062\U000E0077\U000E006C\U000E0073\U000E007F"

# pl-value nationality -> (display name, ISO 3166 alpha-2 or a flag override, continent)
COUNTRIES = {
    "Albania": ("Albania", "AL", EUROPE),
    "Algeria": ("Algeria", "DZ", AFRICA),
    "Argentina": ("Argentina", "AR", S_AMERICA),
    "Australia": ("Australia", "AU", OCEANIA),
    "Austria": ("Austria", "AT", EUROPE),
    "Belgium": ("Belgium", "BE", EUROPE),
    "Bosnia-Herzegovina": ("Bosnia-Herzegovina", "BA", EUROPE),
    "Brazil": ("Brazil", "BR", S_AMERICA),
    "Bulgaria": ("Bulgaria", "BG", EUROPE),
    "Burkina Faso": ("Burkina Faso", "BF", AFRICA),
    "Cameroon": ("Cameroon", "CM", AFRICA),
    "Canada": ("Canada", "CA", N_AMERICA),
    "Chile": ("Chile", "CL", S_AMERICA),
    "Colombia": ("Colombia", "CO", S_AMERICA),
    "Cote d'Ivoire": ("Côte d'Ivoire", "CI", AFRICA),
    "Croatia": ("Croatia", "HR", EUROPE),
    "Czech Republic": ("Czechia", "CZ", EUROPE),
    "DR Congo": ("DR Congo", "CD", AFRICA),
    "Denmark": ("Denmark", "DK", EUROPE),
    "Ecuador": ("Ecuador", "EC", S_AMERICA),
    "Egypt": ("Egypt", "EG", AFRICA),
    "England": ("England", _ENGLAND, EUROPE),
    "France": ("France", "FR", EUROPE),
    "Georgia": ("Georgia", "GE", EUROPE),
    "Germany": ("Germany", "DE", EUROPE),
    "Ghana": ("Ghana", "GH", AFRICA),
    "Greece": ("Greece", "GR", EUROPE),
    "Guinea": ("Guinea", "GN", AFRICA),
    "Haiti": ("Haiti", "HT", N_AMERICA),
    "Hungary": ("Hungary", "HU", EUROPE),
    "Iceland": ("Iceland", "IS", EUROPE),
    "Ireland": ("Ireland", "IE", EUROPE),
    "Israel": ("Israel", "IL", ASIA),
    "Italy": ("Italy", "IT", EUROPE),
    "Jamaica": ("Jamaica", "JM", N_AMERICA),
    "Japan": ("Japan", "JP", ASIA),
    "Korea, South": ("South Korea", "KR", ASIA),
    "Mali": ("Mali", "ML", AFRICA),
    "Mauritania": ("Mauritania", "MR", AFRICA),
    "Mexico": ("Mexico", "MX", N_AMERICA),
    "Morocco": ("Morocco", "MA", AFRICA),
    "Mozambique": ("Mozambique", "MZ", AFRICA),
    "Netherlands": ("Netherlands", "NL", EUROPE),
    "New Zealand": ("New Zealand", "NZ", OCEANIA),
    "Nigeria": ("Nigeria", "NG", AFRICA),
    # No flag emoji exists for Northern Ireland (and the Union Jack is not its flag): its FIFA code instead.
    "Northern Ireland": ("Northern Ireland", "NIR", EUROPE),
    "Norway": ("Norway", "NO", EUROPE),
    "Paraguay": ("Paraguay", "PY", S_AMERICA),
    "Poland": ("Poland", "PL", EUROPE),
    "Portugal": ("Portugal", "PT", EUROPE),
    "Scotland": ("Scotland", _SCOTLAND, EUROPE),
    "Senegal": ("Senegal", "SN", AFRICA),
    "Serbia": ("Serbia", "RS", EUROPE),
    "Slovakia": ("Slovakia", "SK", EUROPE),
    "Slovenia": ("Slovenia", "SI", EUROPE),
    "Spain": ("Spain", "ES", EUROPE),
    "Sweden": ("Sweden", "SE", EUROPE),
    "Switzerland": ("Switzerland", "CH", EUROPE),
    "The Gambia": ("Gambia", "GM", AFRICA),
    "Türkiye": ("Türkiye", "TR", EUROPE),
    "Ukraine": ("Ukraine", "UA", EUROPE),
    "United States": ("United States", "US", N_AMERICA),
    "Uruguay": ("Uruguay", "UY", S_AMERICA),
    "Uzbekistan": ("Uzbekistan", "UZ", ASIA),
    "Wales": ("Wales", _WALES, EUROPE),
}


def flag(code: str) -> str:
    """Flag emoji from an ISO alpha-2 code; subdivision flags pass through."""
    if len(code) != 2:
        return code
    return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in code.upper())
