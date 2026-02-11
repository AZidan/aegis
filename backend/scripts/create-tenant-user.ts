/**
 * Quick script to create a tenant_admin user for a given tenant.
 * Usage: npx ts-node scripts/create-tenant-user.ts <tenantId>
 */
import { PrismaClient } from '../prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

async function main() {
  const tenantId = process.argv[2];
  if (!tenantId) {
    console.error('Usage: npx ts-node scripts/create-tenant-user.ts <tenantId>');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      console.error(`Tenant ${tenantId} not found`);
      process.exit(1);
    }

    const email = `admin@${tenant.companyName.toLowerCase().replace(/\s+/g, '')}.test`;
    const password = await bcrypt.hash('Tenant12345!@', BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email,
        name: `${tenant.companyName} Admin`,
        password,
        role: 'tenant_admin',
        tenantId,
      },
    });

    console.log(`Created tenant admin user:`);
    console.log(`  ID:       ${user.id}`);
    console.log(`  Email:    ${user.email}`);
    console.log(`  Password: Tenant12345!@`);
    console.log(`  Tenant:   ${tenant.companyName} (${tenantId})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
