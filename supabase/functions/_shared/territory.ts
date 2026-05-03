function normalize(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const nutsCommunities: Record<string, string> = {
  ES11: 'Galicia',
  ES12: 'Principado de Asturias',
  ES13: 'Cantabria',
  ES21: 'Pais Vasco',
  ES22: 'Comunidad Foral de Navarra',
  ES23: 'La Rioja',
  ES24: 'Aragon',
  ES30: 'Comunidad de Madrid',
  ES41: 'Castilla y Leon',
  ES42: 'Castilla-La Mancha',
  ES43: 'Extremadura',
  ES51: 'Cataluna',
  ES52: 'Comunitat Valenciana',
  ES53: 'Illes Balears',
  ES61: 'Andalucia',
  ES62: 'Region de Murcia',
  ES63: 'Ciudad de Ceuta',
  ES64: 'Ciudad de Melilla',
  ES70: 'Canarias'
};

const communityAliases: Array<[string, string[]]> = [
  ['Andalucia', ['andalucia', 'almeria', 'cadiz', 'cordoba', 'granada', 'huelva', 'jaen', 'malaga', 'sevilla']],
  ['Aragon', ['aragon', 'huesca', 'teruel', 'zaragoza']],
  ['Canarias', ['canarias', 'las palmas', 'santa cruz de tenerife', 'gran canaria', 'tenerife', 'lanzarote', 'fuerteventura', 'la palma', 'la gomera', 'el hierro']],
  ['Cantabria', ['cantabria', 'santander']],
  ['Castilla y Leon', ['castilla y leon', 'avila', 'burgos', 'leon', 'palencia', 'salamanca', 'segovia', 'soria', 'valladolid', 'zamora']],
  ['Castilla-La Mancha', ['castilla la mancha', 'albacete', 'ciudad real', 'cuenca', 'guadalajara', 'toledo']],
  ['Cataluna', ['cataluna', 'catalunya', 'barcelona', 'girona', 'gerona', 'lleida', 'lerida', 'tarragona']],
  ['Ciudad de Ceuta', ['ceuta']],
  ['Ciudad de Melilla', ['melilla']],
  ['Comunidad de Madrid', ['comunidad de madrid', 'madrid']],
  ['Comunidad Foral de Navarra', ['comunidad foral de navarra', 'navarra', 'nafarroa']],
  ['Comunitat Valenciana', ['comunitat valenciana', 'comunidad valenciana', 'valencia', 'alicante', 'alacant', 'castellon', 'castello']],
  ['Extremadura', ['extremadura', 'badajoz', 'caceres']],
  ['Galicia', ['galicia', 'a coruna', 'coruna', 'lugo', 'ourense', 'orense', 'pontevedra']],
  ['Illes Balears', ['illes balears', 'islas baleares', 'baleares', 'mallorca', 'menorca', 'ibiza', 'eivissa', 'formentera']],
  ['La Rioja', ['la rioja', 'logrono']],
  ['Pais Vasco', ['pais vasco', 'euskadi', 'araba', 'alava', 'bizkaia', 'vizcaya', 'gipuzkoa', 'guipuzcoa']],
  ['Principado de Asturias', ['principado de asturias', 'asturias', 'oviedo']],
  ['Region de Murcia', ['region de murcia', 'murcia']]
];

function communityFromNuts(value: unknown) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = code.match(/ES\d{2,3}/);
  if (!match) return '';
  return nutsCommunities[match[0].slice(0, 4)] || '';
}

function communityFromText(value: unknown) {
  const normalized = normalize(value);
  if (!normalized) return '';
  const fromNuts = communityFromNuts(value);
  if (fromNuts) return fromNuts;
  for (const [community, aliases] of communityAliases) {
    if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) return community;
  }
  return '';
}

export function buildTerritoryLabel(...values: unknown[]) {
  const parts = values
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const community = parts.map(communityFromText).find(Boolean) || '';
  const visibleParts = parts
    .filter((part) => !/^ES\d{2,3}$/i.test(part))
    .filter((part, index, all) => all.findIndex((item) => normalize(item) === normalize(part)) === index)
    .slice(0, 3);
  return [community, ...visibleParts]
    .filter(Boolean)
    .filter((part, index, all) => all.findIndex((item) => normalize(item) === normalize(part)) === index)
    .join(' · ');
}

export function territorialMatches(value: unknown, query: unknown) {
  const expected = normalize(query);
  if (!expected) return true;
  const actual = normalize(value);
  if (actual && (actual.includes(expected) || expected.includes(actual))) return true;
  const expectedCommunity = communityFromText(query);
  const actualCommunity = communityFromText(value);
  return Boolean(expectedCommunity && actualCommunity && expectedCommunity === actualCommunity);
}
