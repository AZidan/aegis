import { PrismaClient } from './generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';

const BCRYPT_ROUNDS = 12;

// Fixed TOTP secret for the platform admin (base32-encoded)
// This is a dev-only secret — never use fixed secrets in production
const ADMIN_MFA_BASE32 = 'JBSWY3DPEHPK3PXP';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Seeding database...');

  // ---------------------------------------------------------------------------
  // Platform Admin
  // ---------------------------------------------------------------------------
  const adminPassword = await bcrypt.hash('Admin12345!@', BCRYPT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@aegis.ai' },
    update: {
      name: 'Platform Admin',
      password: adminPassword,
      role: 'platform_admin',
      mfaEnabled: true,
      mfaSecret: ADMIN_MFA_BASE32,
    },
    create: {
      email: 'admin@aegis.ai',
      name: 'Platform Admin',
      password: adminPassword,
      role: 'platform_admin',
      mfaEnabled: true,
      mfaSecret: ADMIN_MFA_BASE32,
    },
  });
  console.log(`  Platform admin: ${admin.email} (${admin.id})`);
  console.log(`  MFA secret (base32): ${ADMIN_MFA_BASE32}`);
  const otpauthUri = speakeasy.otpauthURL({
    secret: ADMIN_MFA_BASE32,
    encoding: 'base32',
    label: 'admin@aegis.ai',
    issuer: 'Aegis Platform',
  });
  console.log(`  OTP Auth URI: ${otpauthUri}`);

  // ---------------------------------------------------------------------------
  // Demo Tenant
  // ---------------------------------------------------------------------------
  const tenant = await prisma.tenant.upsert({
    where: { companyName: 'Acme Corp' },
    update: {},
    create: {
      companyName: 'Acme Corp',
      adminEmail: 'tenant@acme.com',
      status: 'active',
      plan: 'growth',
    },
  });
  console.log(`  Tenant: ${tenant.companyName} (${tenant.id})`);

  // ---------------------------------------------------------------------------
  // Tenant Admin
  // ---------------------------------------------------------------------------
  const tenantAdminPassword = await bcrypt.hash('Tenant12345!@', BCRYPT_ROUNDS);

  const tenantAdmin = await prisma.user.upsert({
    where: { email: 'tenant@acme.com' },
    update: {
      name: 'Tenant Admin',
      password: tenantAdminPassword,
      role: 'tenant_admin',
      tenantId: tenant.id,
    },
    create: {
      email: 'tenant@acme.com',
      name: 'Tenant Admin',
      password: tenantAdminPassword,
      role: 'tenant_admin',
      tenantId: tenant.id,
    },
  });
  console.log(`  Tenant admin: ${tenantAdmin.email} (${tenantAdmin.id})`);

  // ---------------------------------------------------------------------------
  // Tenant Member
  // ---------------------------------------------------------------------------
  const memberPassword = await bcrypt.hash('Member12345!@', BCRYPT_ROUNDS);

  const member = await prisma.user.upsert({
    where: { email: 'member@acme.com' },
    update: {
      name: 'Team Member',
      password: memberPassword,
      role: 'tenant_member',
      tenantId: tenant.id,
    },
    create: {
      email: 'member@acme.com',
      name: 'Team Member',
      password: memberPassword,
      role: 'tenant_member',
      tenantId: tenant.id,
    },
  });
  console.log(`  Tenant member: ${member.email} (${member.id})`);

  // ---------------------------------------------------------------------------
  // Done
  // ---------------------------------------------------------------------------
  console.log('\nSeed complete. Test credentials:');
  console.log('  Platform Admin:  admin@aegis.ai   / Admin12345!@  (MFA enabled)');
  console.log(`    TOTP Secret: ${ADMIN_MFA_BASE32}`);
  console.log('    Add to authenticator app or generate codes with:');
  console.log(`    npx ts-node -e "const s=require('speakeasy');console.log(s.totp({secret:'${ADMIN_MFA_BASE32}',encoding:'base32'}))"`);
  console.log('  Tenant Admin:    tenant@acme.com   / Tenant12345!@');
  console.log('  Tenant Member:   member@acme.com   / Member12345!@');

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
