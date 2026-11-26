import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
const schema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  location: z.string().optional(),
  draft: z.boolean().default(false),
});
export const collections = {
  news: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/news' }), schema }),
  articles: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/articles' }), schema }),
};
