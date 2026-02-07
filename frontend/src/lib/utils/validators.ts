import { z } from 'zod';

/**
 * Common validation schemas using Zod
 * Used throughout the application for form validation and API request validation
 */

// Email validation
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .min(1, 'Email is required');

// Password validation (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// Name validation (2-50 characters, letters, spaces, hyphens)
export const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be less than 50 characters')
  .regex(/^[a-zA-Z\s-]+$/, 'Name can only contain letters, spaces, and hyphens');

// Company name validation
export const companyNameSchema = z
  .string()
  .min(2, 'Company name must be at least 2 characters')
  .max(100, 'Company name must be less than 100 characters');

// Subdomain validation (lowercase, alphanumeric, hyphens, 3-30 chars)
export const subdomainSchema = z
  .string()
  .min(3, 'Subdomain must be at least 3 characters')
  .max(30, 'Subdomain must be less than 30 characters')
  .regex(/^[a-z0-9-]+$/, 'Subdomain can only contain lowercase letters, numbers, and hyphens')
  .regex(/^[a-z0-9]/, 'Subdomain must start with a letter or number')
  .regex(/[a-z0-9]$/, 'Subdomain must end with a letter or number');

// URL validation
export const urlSchema = z.string().url('Invalid URL format');

// Phone number validation (basic international format)
export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format');

// Agent name validation
export const agentNameSchema = z
  .string()
  .min(2, 'Agent name must be at least 2 characters')
  .max(50, 'Agent name must be less than 50 characters')
  .regex(/^[a-zA-Z0-9\s-_]+$/, 'Agent name can only contain letters, numbers, spaces, hyphens, and underscores');

// Skill name validation
export const skillNameSchema = z
  .string()
  .min(2, 'Skill name must be at least 2 characters')
  .max(50, 'Skill name must be less than 50 characters');

// Description validation
export const descriptionSchema = z
  .string()
  .max(500, 'Description must be less than 500 characters')
  .optional();

// API key validation (UUID format)
export const apiKeySchema = z
  .string()
  .regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i, 'Invalid API key format');

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// Sort schema
export const sortSchema = z.object({
  field: z.string(),
  order: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Validation functions
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

/**
 * Validate password strength
 */
export function isValidPassword(password: string): boolean {
  return passwordSchema.safeParse(password).success;
}

/**
 * Validate subdomain format
 */
export function isValidSubdomain(subdomain: string): boolean {
  return subdomainSchema.safeParse(subdomain).success;
}

/**
 * Check if string is empty or whitespace only
 */
export function isEmpty(value: string | undefined | null): boolean {
  return !value || value.trim().length === 0;
}

/**
 * Check if value is a valid UUID
 */
export function isUUID(value: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}

/**
 * Sanitize HTML input to prevent XSS
 */
export function sanitizeHtml(input: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return input.replace(/[&<>"'/]/g, (char) => map[char] || char);
}
