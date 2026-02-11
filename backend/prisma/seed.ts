import { PrismaClient, Prisma } from './generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import { ROLE_TEMPLATES } from './seed-templates';

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

  // Build a map of role templates for merging
  const templateMap = new Map(ROLE_TEMPLATES.map((t) => [t.name, t]));

  for (const rc of roleConfigs) {
    const tmpl = templateMap.get(rc.name);
    const templateFields = tmpl
      ? {
          soulTemplate: tmpl.soulTemplate,
          agentsTemplate: tmpl.agentsTemplate,
          heartbeatTemplate: tmpl.heartbeatTemplate,
          userTemplate: tmpl.userTemplate,
          identityEmoji: tmpl.identityEmoji,
          openclawConfigTemplate: tmpl.openclawConfigTemplate as Prisma.InputJsonValue,
        }
      : {};

    await prisma.agentRoleConfig.upsert({
      where: { name: rc.name },
      update: {
        label: rc.label,
        description: rc.description,
        color: rc.color,
        defaultToolCategories: rc.defaultToolCategories,
        sortOrder: rc.sortOrder,
        ...templateFields,
      },
      create: { ...rc, isSystem: true, ...templateFields },
    });
    console.log(`  Role config: ${rc.name} (${rc.label})${tmpl ? ' + templates' : ''}`);
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
  // Skills - Marketplace Skill Catalog (12 skills, 3 per category)
  // ---------------------------------------------------------------------------
  console.log('\n  Seeding skill catalog...');

  // Clear existing installations and skills to avoid duplicates on re-seed
  await prisma.skillInstallation.deleteMany({});
  await prisma.skill.deleteMany({});

  // --- Productivity Skills ---
  const taskAutomator = await prisma.skill.create({
    data: {
      name: 'Task Automator',
      version: '1.2.0',
      description:
        'Automates repetitive task workflows including ticket triage, status updates, and cross-tool synchronization. Supports Jira, Linear, and Asana integrations.',
      category: 'productivity',
      status: 'approved',
      isCore: true,
      authorId: admin.id,
      compatibleRoles: ['pm', 'operations', 'custom'],
      permissions: {
        network: ['api.jira.com', 'api.linear.app', 'api.asana.com'],
        files: ['tmp/task-cache'],
        env: ['JIRA_API_TOKEN', 'LINEAR_API_KEY'],
      },
      documentation:
        '# Task Automator\n\nAutomate your project management workflows.\n\n## Setup\n\n1. Connect your project management tool\n2. Configure automation rules\n3. Enable the skill on your agent',
      changelog:
        '## v1.2.0\n- Added Asana integration\n- Improved triage accuracy\n\n## v1.1.0\n- Added Linear support\n\n## v1.0.0\n- Initial release with Jira support',
      rating: 4.7,
      installCount: 3200,
    },
  });
  console.log(`  Skill: ${taskAutomator.name} (${taskAutomator.id})`);

  const documentGenerator = await prisma.skill.create({
    data: {
      name: 'Document Generator',
      version: '2.0.1',
      description:
        'Generates professional documents from templates including PRDs, design docs, and meeting notes. Supports Markdown, PDF, and Confluence export.',
      category: 'productivity',
      status: 'approved',
      isCore: true,
      authorId: admin.id,
      compatibleRoles: ['pm', 'engineering', 'data', 'custom'],
      permissions: {
        network: ['api.confluence.com', 'api.notion.so'],
        files: ['tmp/docs', 'templates/'],
        env: ['CONFLUENCE_TOKEN'],
      },
      documentation:
        '# Document Generator\n\nGenerate documents from templates.\n\n## Templates\n\n- PRD Template\n- Design Doc\n- Meeting Notes\n- Status Report',
      changelog:
        '## v2.0.1\n- Bug fix for PDF export\n\n## v2.0.0\n- Added Confluence export\n- New template engine',
      rating: 4.5,
      installCount: 2100,
    },
  });
  console.log(`  Skill: ${documentGenerator.name} (${documentGenerator.id})`);

  const meetingSummarizer = await prisma.skill.create({
    data: {
      name: 'Meeting Summarizer',
      version: '1.0.3',
      description:
        'Listens to meeting transcripts and produces structured summaries with action items, decisions, and key takeaways. Integrates with Zoom and Google Meet.',
      category: 'productivity',
      status: 'approved',
      isCore: true,
      authorId: admin.id,
      compatibleRoles: ['pm', 'hr', 'custom'],
      permissions: {
        network: ['api.zoom.us', 'meet.googleapis.com'],
        files: ['tmp/transcripts'],
        env: ['ZOOM_API_KEY'],
      },
      documentation:
        '# Meeting Summarizer\n\nAutomatically summarize meetings.\n\n## Features\n\n- Action item extraction\n- Decision tracking\n- Key takeaway highlights',
      changelog:
        '## v1.0.3\n- Improved action item detection\n\n## v1.0.2\n- Google Meet integration\n\n## v1.0.0\n- Initial release',
      rating: 4.2,
      installCount: 1500,
    },
  });
  console.log(`  Skill: ${meetingSummarizer.name} (${meetingSummarizer.id})`);

  // --- Analytics Skills ---
  const dataDashboardBuilder = await prisma.skill.create({
    data: {
      name: 'Data Dashboard Builder',
      version: '3.1.0',
      description:
        'Creates interactive data dashboards from SQL queries, CSV uploads, and API data sources. Supports chart types including bar, line, pie, and heatmaps.',
      category: 'analytics',
      status: 'approved',
      isCore: true,
      authorId: admin.id,
      compatibleRoles: ['data', 'pm', 'engineering', 'custom'],
      permissions: {
        network: ['api.metabase.com', 'api.looker.com'],
        files: ['tmp/data', 'dashboards/'],
        env: ['METABASE_TOKEN', 'DB_READ_URL'],
      },
      documentation:
        '# Data Dashboard Builder\n\nBuild dashboards from multiple data sources.\n\n## Data Sources\n\n- SQL databases\n- CSV files\n- REST APIs\n- Metabase/Looker',
      changelog:
        '## v3.1.0\n- Added heatmap chart type\n- Improved SQL query builder\n\n## v3.0.0\n- Major redesign\n- Added Looker integration',
      rating: 4.8,
      installCount: 5000,
    },
  });
  console.log(
    `  Skill: ${dataDashboardBuilder.name} (${dataDashboardBuilder.id})`,
  );

  const trendAnalyzer = await prisma.skill.create({
    data: {
      name: 'Trend Analyzer',
      version: '1.5.2',
      description:
        'Analyzes time-series data to identify trends, anomalies, and seasonal patterns. Provides forecasting with confidence intervals and alerting on significant deviations.',
      category: 'analytics',
      status: 'approved',
      isCore: true,
      authorId: admin.id,
      compatibleRoles: ['data', 'operations', 'custom'],
      permissions: {
        network: ['api.datadog.com'],
        files: ['tmp/analysis'],
        env: ['DATADOG_API_KEY'],
      },
      documentation:
        '# Trend Analyzer\n\nIdentify trends and anomalies in your data.\n\n## Algorithms\n\n- Moving average\n- Exponential smoothing\n- Seasonal decomposition',
      changelog:
        '## v1.5.2\n- Improved anomaly detection sensitivity\n\n## v1.5.0\n- Added forecasting with confidence intervals',
      rating: 4.3,
      installCount: 890,
    },
  });
  console.log(`  Skill: ${trendAnalyzer.name} (${trendAnalyzer.id})`);

  const reportGenerator = await prisma.skill.create({
    data: {
      name: 'Report Generator',
      version: '2.2.0',
      description:
        'Generates scheduled and on-demand reports from multiple data sources. Supports weekly summaries, sprint retrospectives, and executive briefings with auto-distribution.',
      category: 'analytics',
      status: 'approved',
      isCore: true,
      authorId: admin.id,
      compatibleRoles: ['data', 'pm', 'operations', 'custom'],
      permissions: {
        network: ['smtp.gmail.com', 'api.slack.com'],
        files: ['tmp/reports', 'reports/'],
        env: ['SMTP_PASSWORD', 'SLACK_WEBHOOK_URL'],
      },
      documentation:
        '# Report Generator\n\nAutomate report generation and distribution.\n\n## Report Types\n\n- Weekly Summary\n- Sprint Retrospective\n- Executive Briefing\n- Custom Templates',
      changelog:
        '## v2.2.0\n- Added executive briefing template\n- Auto-distribution via Slack\n\n## v2.1.0\n- Sprint retrospective support',
      rating: 4.1,
      installCount: 1200,
    },
  });
  console.log(`  Skill: ${reportGenerator.name} (${reportGenerator.id})`);

  // --- Engineering Skills ---
  const codeReviewAssistant = await prisma.skill.create({
    data: {
      name: 'Code Review Assistant',
      version: '2.0.0',
      description:
        'Performs automated code reviews on pull requests. Checks for security vulnerabilities, code style violations, performance issues, and suggests improvements with inline comments.',
      category: 'engineering',
      status: 'approved',
      isCore: true,
      authorId: admin.id,
      compatibleRoles: ['engineering', 'custom'],
      permissions: {
        network: ['api.github.com', 'api.gitlab.com'],
        files: ['tmp/code-review'],
        env: ['GITHUB_TOKEN', 'GITLAB_TOKEN'],
      },
      documentation:
        '# Code Review Assistant\n\nAutomated code review for your PRs.\n\n## Checks\n\n- Security vulnerabilities (OWASP Top 10)\n- Code style (configurable rules)\n- Performance anti-patterns\n- Test coverage gaps',
      changelog:
        '## v2.0.0\n- Added GitLab support\n- Security vulnerability scanning\n\n## v1.0.0\n- Initial release with GitHub support',
      rating: 4.9,
      installCount: 4500,
    },
  });
  console.log(
    `  Skill: ${codeReviewAssistant.name} (${codeReviewAssistant.id})`,
  );

  const cicdPipelineManager = await prisma.skill.create({
    data: {
      name: 'CI/CD Pipeline Manager',
      version: '1.3.1',
      description:
        'Monitors and manages CI/CD pipelines across GitHub Actions, GitLab CI, and Jenkins. Provides build failure diagnostics, deployment status tracking, and rollback automation.',
      category: 'engineering',
      status: 'approved',
      isCore: true,
      authorId: admin.id,
      compatibleRoles: ['engineering', 'operations', 'custom'],
      permissions: {
        network: [
          'api.github.com',
          'api.gitlab.com',
          'jenkins.internal.com',
        ],
        files: ['tmp/pipeline-logs'],
        env: ['GITHUB_TOKEN', 'JENKINS_API_KEY'],
      },
      documentation:
        '# CI/CD Pipeline Manager\n\nManage your CI/CD pipelines.\n\n## Supported Platforms\n\n- GitHub Actions\n- GitLab CI\n- Jenkins\n\n## Features\n\n- Build failure diagnosis\n- Deployment tracking\n- Automated rollback',
      changelog:
        '## v1.3.1\n- Fixed Jenkins polling interval\n\n## v1.3.0\n- Added rollback automation\n\n## v1.2.0\n- GitLab CI support',
      rating: 4.4,
      installCount: 1800,
    },
  });
  console.log(
    `  Skill: ${cicdPipelineManager.name} (${cicdPipelineManager.id})`,
  );

  const securityScanner = await prisma.skill.create({
    data: {
      name: 'Security Scanner',
      version: '1.1.0',
      description:
        'Scans repositories and dependencies for known CVEs, license compliance issues, and secret leaks. Integrates with Snyk, Trivy, and GitHub Advanced Security.',
      category: 'engineering',
      status: 'approved',
      isCore: true,
      authorId: admin.id,
      compatibleRoles: ['engineering', 'operations', 'custom'],
      permissions: {
        network: ['api.snyk.io', 'api.github.com'],
        files: ['tmp/scan-results'],
        env: ['SNYK_TOKEN', 'GITHUB_TOKEN'],
      },
      documentation:
        '# Security Scanner\n\nScan your code for vulnerabilities.\n\n## Scan Types\n\n- Dependency CVE scanning\n- Secret detection\n- License compliance\n- Container image scanning',
      changelog:
        '## v1.1.0\n- Added Trivy container scanning\n- Improved secret detection\n\n## v1.0.0\n- Initial release with Snyk integration',
      rating: 4.6,
      installCount: 2800,
    },
  });
  console.log(`  Skill: ${securityScanner.name} (${securityScanner.id})`);

  // --- Communication Skills ---
  const slackBotManager = await prisma.skill.create({
    data: {
      name: 'Slack Bot Manager',
      version: '1.4.0',
      description:
        'Manages Slack bot interactions including automated responses, channel notifications, thread summarization, and workflow triggers based on message patterns.',
      category: 'communication',
      status: 'approved',
      isCore: true,
      authorId: admin.id,
      compatibleRoles: ['operations', 'support', 'pm', 'custom'],
      permissions: {
        network: ['api.slack.com', 'hooks.slack.com'],
        files: ['tmp/slack-cache'],
        env: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'],
      },
      documentation:
        '# Slack Bot Manager\n\nManage Slack bot interactions.\n\n## Features\n\n- Auto-responses\n- Channel notifications\n- Thread summarization\n- Workflow triggers',
      changelog:
        '## v1.4.0\n- Thread summarization\n- Workflow trigger support\n\n## v1.3.0\n- Improved pattern matching',
      rating: 4.0,
      installCount: 1600,
    },
  });
  console.log(`  Skill: ${slackBotManager.name} (${slackBotManager.id})`);

  const emailComposer = await prisma.skill.create({
    data: {
      name: 'Email Composer',
      version: '1.0.1',
      description:
        'Drafts and sends professional emails using templates and context-aware composition. Supports scheduling, follow-up tracking, and A/B subject line testing.',
      category: 'communication',
      status: 'approved',
      isCore: true,
      authorId: admin.id,
      compatibleRoles: ['support', 'hr', 'pm', 'custom'],
      permissions: {
        network: ['smtp.gmail.com', 'api.sendgrid.com'],
        files: ['tmp/email-drafts', 'templates/email'],
        env: ['SENDGRID_API_KEY', 'SMTP_PASSWORD'],
      },
      documentation:
        '# Email Composer\n\nDraft and send professional emails.\n\n## Features\n\n- Template-based composition\n- Scheduled sending\n- Follow-up tracking\n- A/B subject testing',
      changelog:
        '## v1.0.1\n- Fixed scheduling timezone issues\n\n## v1.0.0\n- Initial release',
      rating: 3.8,
      installCount: 450,
    },
  });
  console.log(`  Skill: ${emailComposer.name} (${emailComposer.id})`);

  const notificationRouter = await prisma.skill.create({
    data: {
      name: 'Notification Router',
      version: '2.1.0',
      description:
        'Routes notifications across multiple channels based on priority, recipient preferences, and escalation rules. Supports Slack, email, SMS, and PagerDuty.',
      category: 'communication',
      status: 'approved',
      isCore: true,
      authorId: admin.id,
      compatibleRoles: ['operations', 'engineering', 'support', 'custom'],
      permissions: {
        network: [
          'api.slack.com',
          'api.twilio.com',
          'api.pagerduty.com',
          'smtp.gmail.com',
        ],
        files: ['tmp/notification-queue'],
        env: ['TWILIO_SID', 'PAGERDUTY_API_KEY', 'SLACK_WEBHOOK_URL'],
      },
      documentation:
        '# Notification Router\n\nIntelligent notification routing.\n\n## Channels\n\n- Slack\n- Email\n- SMS (Twilio)\n- PagerDuty\n\n## Routing Rules\n\n- Priority-based\n- Preference-based\n- Escalation chains',
      changelog:
        '## v2.1.0\n- Added PagerDuty escalation\n- Priority-based routing\n\n## v2.0.0\n- Multi-channel support',
      rating: 4.5,
      installCount: 950,
    },
  });
  console.log(
    `  Skill: ${notificationRouter.name} (${notificationRouter.id})`,
  );

  // ---------------------------------------------------------------------------
  // Install some skills on demo agents
  // ---------------------------------------------------------------------------
  console.log('\n  Installing skills on demo agents...');

  // Sprint Planner (agent1, PM) gets Task Automator and Document Generator
  await prisma.skillInstallation.create({
    data: { agentId: agent1.id, skillId: taskAutomator.id },
  });
  console.log(
    `  Installed "${taskAutomator.name}" on "${agent1.name}"`,
  );

  await prisma.skillInstallation.create({
    data: { agentId: agent1.id, skillId: documentGenerator.id },
  });
  console.log(
    `  Installed "${documentGenerator.name}" on "${agent1.name}"`,
  );

  // Code Reviewer (agent2, Engineering) gets Code Review Assistant
  await prisma.skillInstallation.create({
    data: { agentId: agent2.id, skillId: codeReviewAssistant.id },
  });
  console.log(
    `  Installed "${codeReviewAssistant.name}" on "${agent2.name}"`,
  );

  // Infra Monitor (agent3, Operations) gets Notification Router
  await prisma.skillInstallation.create({
    data: { agentId: agent3.id, skillId: notificationRouter.id },
  });
  console.log(
    `  Installed "${notificationRouter.name}" on "${agent3.name}"`,
  );

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
