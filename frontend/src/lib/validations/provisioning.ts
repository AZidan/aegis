import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const INDUSTRIES = [
  { value: 'technology', label: 'Technology' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance' },
  { value: 'education', label: 'Education' },
  { value: 'retail', label: 'Retail' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'other', label: 'Other' },
] as const;

export const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '500+', label: '500+ employees' },
] as const;

export const DEPLOYMENT_REGIONS = [
  { value: 'us-east-1', label: 'US East (Virginia)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU West (Ireland)' },
  { value: 'eu-central-1', label: 'EU Central (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
] as const;

export const PLANS = [
  {
    value: 'starter' as const,
    label: 'Starter',
    price: { monthly: 99, annual: 79 },
    agents: '3',
    storage: '10 GB',
    support: 'Email support',
    description: 'Perfect for small teams',
  },
  {
    value: 'growth' as const,
    label: 'Pro',
    price: { monthly: 299, annual: 239 },
    agents: '10',
    storage: '100 GB',
    support: 'Priority support',
    description: 'Growing teams',
    popular: true,
  },
  {
    value: 'enterprise' as const,
    label: 'Enterprise',
    price: { monthly: 799, annual: 639 },
    agents: 'Unlimited',
    storage: '1 TB',
    support: '24/7 dedicated support',
    description: 'Large organizations',
  },
] as const;

export const STORAGE_OPTIONS = [
  { value: 10, label: '10 GB' },
  { value: 25, label: '25 GB' },
  { value: 50, label: '50 GB' },
  { value: 100, label: '100 GB' },
  { value: 250, label: '250 GB' },
  { value: 500, label: '500 GB' },
  { value: 1000, label: '1 TB' },
] as const;

export const PLAN_AGENT_LIMITS: Record<string, number> = {
  starter: 3,
  growth: 10,
  enterprise: 50,
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const step1Schema = z.object({
  companyName: z
    .string()
    .min(3, 'Company name must be at least 3 characters')
    .max(50, 'Company name must be at most 50 characters'),
  adminEmail: z
    .string()
    .min(1, 'Admin email is required')
    .email('Please enter a valid email address'),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  deploymentRegion: z.string().min(1, 'Deployment region is required'),
  notes: z.string().max(500, 'Notes must be at most 500 characters').optional(),
});

export const step2Schema = z.object({
  plan: z.enum(['starter', 'growth', 'enterprise'], {
    message: 'Please select a plan',
  }),
  billingCycle: z.enum(['monthly', 'annual']),
  maxAgents: z.number().min(1).max(50),
  maxSkills: z.number().min(5).max(200),
  storageLimitGb: z.number(),
});

export const provisioningFormSchema = step1Schema.merge(step2Schema);

export type Step1FormData = z.infer<typeof step1Schema>;
export type Step2FormData = z.infer<typeof step2Schema>;
export type ProvisioningFormData = z.infer<typeof provisioningFormSchema>;
