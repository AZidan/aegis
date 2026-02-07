import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 Configuration
 *
 * This file configures how the Prisma CLI interacts with your database.
 * The database URL is now configured here instead of in schema.prisma.
 *
 * @see https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
 */
export default defineConfig({
  /**
   * Path to your Prisma schema file
   */
  schema: 'prisma/schema.prisma',

  /**
   * Database connection configuration
   * Uses environment variable for the connection URL
   */
  datasource: {
    url: env('DATABASE_URL'),
  },

  /**
   * Migration configuration
   * Defines where migrations are stored and seed command
   */
  migrations: {
    output: 'prisma/migrations',
    seed: 'npx ts-node prisma/seed.ts',
  },
});
