import { site, type Location } from './data/site';
export const restaurantLd = (l: Location, base: URL) => ({
  '@context': 'https://schema.org',
  '@type': 'FastFoodRestaurant',
  '@id': new URL(`/locations/${l.slug}/#restaurant`, base).href,
  name: `${site.name} — ${l.name}`,
  url: new URL(`/locations/${l.slug}/`, base).href,
  image: new URL('/img/bull.png', base).href,
  telephone: l.phone.replace(/[^+\d]/g, ''),
  priceRange: l.avgCheck,
  servesCuisine: ['Турецкая', 'Фастфуд', 'Донер'],
  menu: new URL('/menu/', base).href,
  acceptsReservations: false,
  hasMap: l.yandexUrl,
  parentOrganization: { '@id': new URL('/#org', base).href },
  address: {
    '@type': 'PostalAddress',
    streetAddress: `${l.address}${l.floor ? ', ' + l.floor : ''}`,
    addressLocality: 'Москва',
    postalCode: l.postalCode,
    addressCountry: 'RU',
  },
  geo: { '@type': 'GeoCoordinates', latitude: l.geo.lat, longitude: l.geo.lon },
  openingHoursSpecification: l.hours.map((h) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: h.schema.map((d) => ({ Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday' })[d]),
    opens: h.open,
    closes: h.close,
  })),
  potentialAction: { '@type': 'OrderAction', target: l.edaUrl, deliveryMethod: 'http://purl.org/goodrelations/v1#DeliveryModeOwnFleet' },
});
export const crumbsLd = (items: [string, string][], base: URL) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: new URL(path, base).href })),
});
export const fmtDate = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
