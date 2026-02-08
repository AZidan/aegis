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
  // Default Agent Role Configs (upsert to avoid duplicates)
  // ---------------------------------------------------------------------------
  console.log('\n  Seeding agent role configs...');

  const roleConfigs = [
    { name: 'pm', label: 'Product Management', description: 'Product managers, sprint planning, backlog management', color: '#8b5cf6', defaultToolCategories: ['analytics', 'project_management', 'communication', 'web_search'], sortOrder: 1 },
    { name: 'engineering', label: 'Engineering', description: 'Software engineers, code review, architecture', color: '#3b82f6', defaultToolCategories: ['code_management', 'devops', 'monitoring', 'web_search'], sortOrder: 2 },
    { name: 'operations', label: 'Operations', description: 'Operations team, monitoring, incident response', color: '#14b8a6', defaultToolCategories: ['communication', 'monitoring', 'project_management', 'web_search'], sortOrder: 3 },
    { name: 'support', label: 'Customer Support', description: 'Customer support, ticket management, knowledge base', color: '#ec4899', defaultToolCategories: ['communication', 'web_search'], sortOrder: 4 },
    { name: 'data', label: 'Data & Analytics', description: 'Data analysis, reporting, business intelligence', color: '#6366f1', defaultToolCategories: ['analytics', 'data_access', 'web_search'], sortOrder: 5 },
    { name: 'hr', label: 'Human Resources', description: 'HR operations, recruiting, employee management', color: '#f59e0b', defaultToolCategories: ['communication', 'web_search'], sortOrder: 6 },
    { name: 'custom', label: 'Custom', description: 'Custom agent role with minimal defaults', color: '#6b7280', defaultToolCategories: ['web_search', 'communication'], sortOrder: 7 },
  ];

  for (const rc of roleConfigs) {
    await prisma.agentRoleConfig.upsert({
      where: { name: rc.name },
      update: { label: rc.label, description: rc.description, color: rc.color, defaultToolCategories: rc.defaultToolCategories, sortOrder: rc.sortOrder },
      create: { ...rc, isSystem: true },
    });
    console.log(`  Role config: ${rc.name} (${rc.label})`);
  }

  // ---------------------------------------------------------------------------
  // Demo Agents (for Acme Corp tenant)
  // ---------------------------------------------------------------------------
  console.log('\n  Seeding agents for Acme Corp...');

  // Delete existing agents for this tenant to avoid duplicates on re-seed
  await prisma.agent.deleteMany({ where: { tenantId: tenant.id } });

  const agent1 = await prisma.agent.create({
    data: {
      name: 'Sprint Planner',
      description: 'Manages sprint planning, backlog grooming, and story point estimation.',
      role: 'pm',
      status: 'active',
      modelTier: 'sonnet',
      thinkingMode: 'standard',
      temperature: 0.3,
      avatarColor: '#8b5cf6',
      toolPolicy: { allow: ['jira', 'confluence', 'slack'] },
      tenantId: tenant.id,
      lastActive: new Date(),
    },
  });
  console.log(`  Agent: ${agent1.name} (${agent1.id}) - role: pm, status: active`);

  const agent2 = await prisma.agent.create({
    data: {
      name: 'Code Reviewer',
      description: 'Performs automated code reviews, checks for security issues, and suggests improvements.',
      role: 'engineering',
      status: 'idle',
      modelTier: 'opus',
      thinkingMode: 'extended',
      temperature: 0.1,
      avatarColor: '#3b82f6',
      toolPolicy: { allow: ['github', 'sonarqube', 'eslint'] },
      tenantId: tenant.id,
      lastActive: new Date(Date.now() - 72 * 60 * 60 * 1000), // 3 days ago
    },
  });
  console.log(`  Agent: ${agent2.name} (${agent2.id}) - role: engineering, status: idle`);

  const agent3 = await prisma.agent.create({
    data: {
      name: 'Infra Monitor',
      description: 'Monitors infrastructure health, alerts on anomalies, and runs incident response playbooks.',
      role: 'operations',
      status: 'error',
      modelTier: 'haiku',
      thinkingMode: 'fast',
      temperature: 0.5,
      avatarColor: '#14b8a6',
      toolPolicy: { allow: ['datadog', 'pagerduty', 'aws'] },
      tenantId: tenant.id,
      lastActive: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    },
  });
  console.log(`  Agent: ${agent3.name} (${agent3.id}) - role: operations, status: error`);

  const agent4 = await prisma.agent.create({
    data: {
      name: 'Customer Insights',
      description: 'Analyzes customer feedback, generates reports, and tracks NPS trends.',
      role: 'custom',
      status: 'active',
      modelTier: 'sonnet',
      thinkingMode: 'standard',
      temperature: 0.7,
      avatarColor: '#6b7280',
      toolPolicy: { allow: ['intercom', 'google-analytics', 'notion'] },
      tenantId: tenant.id,
      lastActive: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
    },
  });
  console.log(`  Agent: ${agent4.name} (${agent4.id}) - role: custom, status: active`);

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
