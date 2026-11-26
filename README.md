# Alibaba Doner — сайт (Astro, статический)

```
npm install
npm run dev      # локально: http://localhost:4321
npm run build    # готовый сайт в dist/ — выкладывается на любой хостинг
```

## Где что менять
- `src/data/site.ts` — точки (адреса, телефоны, часы, ссылки на Яндекс Еду), меню, преимущества, FAQ. Все места под уточнение помечены `TODO`.
- `src/content/news/*.md`, `src/content/articles/*.md` — новости и статьи (один файл = одна страница).
- `public/video/hero.mp4` и `hero.webm` — фоновое видео главной (до 6–8 МБ, 10–20 с, без звука, 1920×1080).
- `astro.config.mjs` — домен сайта (`site`), сейчас alibaba-doner.ru.
- `src/pages/robots.txt.ts` — до запуска сайт закрыт от индексации (`INDEX = false`). При запуске поставить `true`.

## Публикация
При пуше в `main` GitHub Actions собирает сайт и публикует на GitHub Pages (домен из `public/CNAME`). В настройках репозитория: Settings → Pages → Source: **GitHub Actions**.
- Переключатель стилей A/B/C в `src/layouts/Base.astro` (блок `.styler`) — удалить после выбора.
- `public/img/food/` — фото блюд (webp, 640 и 1200 px).

## Форма отзывов
Отправляет POST на `/api/feedback`. Нужен приёмник: Telegram-бот директора (функция на Yandex Cloud Functions) или почта.

## SEO
title/description, canonical, OpenGraph, schema.org (Organization, FastFoodRestaurant для каждой точки, Menu, FAQPage, NewsArticle/Article, BreadcrumbList), sitemap-index.xml, robots.txt.
