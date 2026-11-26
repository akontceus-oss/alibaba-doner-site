import type { APIRoute } from 'astro';
// До запуска сайт закрыт от индексации. При запуске поставить INDEX = true.
const INDEX = false;
export const GET: APIRoute = ({ site }) =>
  new Response(
    INDEX
      ? `User-agent: *\nAllow: /\nDisallow: /api/\n\nHost: ${site!.host}\nSitemap: ${new URL('sitemap-index.xml', site).href}\n`
      : `User-agent: *\nDisallow: /\n`,
  );
