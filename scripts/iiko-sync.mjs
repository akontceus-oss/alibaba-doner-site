// Синхронизация меню и стоп-листов из iikoCloud API (iikoTransport) в data/*.json.
// Только чтение: скрипт ничего не меняет в iiko.
//
// Ключи берутся из секрета IIKO_API_LOGINS — JSON вида {"aminevskoe": "<apiLogin>", ...}.
// У каждой точки свой iikoWeb, поэтому и API-логин у каждой свой.
// Для одной точки можно задать IIKO_API_LOGIN, тогда она считается точкой "aminevskoe".
//
// Режимы: `node scripts/iiko-sync.mjs menu` — меню, цены, фото;
//         `node scripts/iiko-sync.mjs stops` — только стоп-листы.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const API = 'https://api-ru.iiko.services';
const MENU_NAME = process.env.IIKO_MENU_NAME || 'Сайт (копия ЯндексЕда)';
const FALLBACK_MENU_NAME = 'Сайт';
// Служебные группы iiko, которые не показываем на сайте
const HIDDEN_CATEGORIES = new Set(['Допы', 'Служебные', 'Магазин', 'Яндекс Еда']);
const mode = process.argv[2] || 'menu';

function apiLogins() {
  if (process.env.IIKO_API_LOGINS) return JSON.parse(process.env.IIKO_API_LOGINS);
  if (process.env.IIKO_API_LOGIN) return { aminevskoe: process.env.IIKO_API_LOGIN };
  throw new Error('Не задан IIKO_API_LOGINS или IIKO_API_LOGIN');
}

async function call(path, body, token) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function connect(point, rawLogin) {
  // pbpaste и формы GitHub могут добавить пробелы или перевод строки
  const apiLogin = String(rawLogin).trim();
  if (apiLogin !== rawLogin) console.log(`${point}: у ключа убраны пробелы по краям`);
  console.log(`${point}: длина ключа ${apiLogin.length}`);
  const { token } = await call('/api/1/access_token', { apiLogin });
  const { organizations } = await call('/api/1/organizations', { returnAdditionalInfo: false, includeDisabled: false }, token);
  if (!organizations?.length) throw new Error(`${point}: у API-логина нет организаций`);
  const orgIds = organizations.map((o) => o.id);
  const tg = await call('/api/1/terminal_groups', { organizationIds: orgIds }, token);
  const terminalGroups = (tg.terminalGroups || []).flatMap((g) => g.items || []).map((t) => ({ id: t.id, name: t.name, address: t.address, organizationId: t.organizationId }));
  return { point, token, organizations: organizations.map((o) => ({ id: o.id, name: o.name })), orgIds, terminalGroups };
}

async function fetchMenu(c) {
  const list = await call('/api/2/menu', {}, c.token);
  const menus = list.externalMenus || [];
  const menu = menus.find((m) => m.name === MENU_NAME) || menus.find((m) => m.name === FALLBACK_MENU_NAME);
  if (!menu) throw new Error(`${c.point}: нет внешнего меню «${MENU_NAME}». Есть: ${menus.map((m) => m.name).join(', ')}`);
  const data = await call('/api/2/menu/by_id', { externalMenuId: String(menu.id), organizationIds: c.orgIds, priceCategoryId: null, version: 2 }, c.token);
  return { menuName: menu.name, data };
}

function priceFor(size, orgIds) {
  for (const p of size?.prices || []) {
    if (p.price != null && (!p.organizations || p.organizations.some((o) => orgIds.includes(o)))) return p.price;
  }
  return null;
}

function normalize(c, menuName, data) {
  const categories = [];
  const items = [];
  for (const cat of data.itemCategories || []) {
    if (cat.isHidden || HIDDEN_CATEGORIES.has(cat.name?.trim())) continue;
    categories.push({ id: cat.id, name: cat.name });
    for (const it of cat.items || []) {
      if (it.isHidden) continue;
      const size = (it.itemSizes || []).find((s) => s.isDefault) || (it.itemSizes || [])[0] || {};
      items.push({
        id: it.itemId,
        sku: it.sku || size.sku || null,
        categoryId: cat.id,
        name: it.name,
        description: (it.description || '').trim(),
        weight: size.portionWeightGrams || null,
        imageUrl: size.buttonImageUrl || it.buttonImageUrl || null,
        price: priceFor(size, c.orgIds),
      });
    }
  }
  return { point: c.point, menuName, organizations: c.organizations, terminalGroups: c.terminalGroups, categories, items };
}

async function downloadImages(items) {
  await mkdir('images/menu', { recursive: true });
  let sharp = null;
  try { sharp = (await import('sharp')).default; } catch {}
  for (const it of items) {
    if (!it.imageUrl || !it.sku) continue;
    const file = `images/menu/${it.sku}.${sharp ? 'webp' : 'jpg'}`;
    const marker = `images/menu/${it.sku}.src`;
    const known = existsSync(marker) ? (await readFile(marker, 'utf8')).trim() : '';
    if (known === it.imageUrl && existsSync(file)) { it.image = file; continue; }
    const res = await fetch(it.imageUrl);
    if (!res.ok) { console.warn(`Фото ${it.sku}: HTTP ${res.status}`); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(file, sharp ? await sharp(buf).rotate().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer() : buf);
    await writeFile(marker, it.imageUrl + '\n');
    it.image = file;
  }
}

// Записываем файл, только если содержимое поменялось (без учёта даты обновления),
// чтобы не плодить пустые коммиты.
async function writeIfChanged(path, obj) {
  const body = (o) => JSON.stringify({ ...o, updatedAt: undefined }, null, 2);
  if (existsSync(path)) {
    try { if (body(JSON.parse(await readFile(path, 'utf8'))) === body(obj)) return false; } catch {}
  }
  await writeFile(path, JSON.stringify(obj, null, 2) + '\n');
  return true;
}

async function main() {
  await mkdir('data', { recursive: true });
  const conns = [];
  for (const [point, login] of Object.entries(apiLogins())) conns.push(await connect(point, login));

  if (mode === 'menu') {
    const points = [];
    for (const c of conns) {
      const { menuName, data } = await fetchMenu(c);
      const p = normalize(c, menuName, data);
      await downloadImages(p.items);
      for (const it of p.items) delete it.imageUrl;
      points.push(p);
      console.log(`${c.point}: меню «${menuName}», ${p.categories.length} групп, ${p.items.length} позиций`);
    }
    const changed = await writeIfChanged('data/menu.json', { updatedAt: new Date().toISOString(), source: 'iiko', points });
    console.log(changed ? 'data/menu.json обновлён' : 'Меню не изменилось');
  } else if (mode === 'stops') {
    const stops = {};
    for (const c of conns) {
      const r = await call('/api/1/stop_lists', { organizationIds: c.orgIds }, c.token);
      const ids = new Set();
      for (const org of r.terminalGroupStopLists || []) for (const tg of org.items || []) for (const s of tg.items || []) {
        if ((s.balance ?? 0) <= 0) ids.add(s.sku || s.productId);
      }
      stops[c.point] = [...ids].sort();
    }
    const changed = await writeIfChanged('data/stops.json', { updatedAt: new Date().toISOString(), stops });
    console.log(changed ? 'data/stops.json обновлён' : 'Стопы не изменились');
  } else {
    throw new Error(`Неизвестный режим: ${mode}`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
