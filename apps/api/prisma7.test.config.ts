import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

const loaded = config({
  path: new URL('./.env.test', import.meta.url),
  override: true,
});

if (loaded.error) {
  throw loaded.error;
}

const url = loaded.parsed?.DATABASE_URL;

if (!url) {
  throw new Error('.env.test에 DATABASE_URL이 필요합니다');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url,
  },
});
