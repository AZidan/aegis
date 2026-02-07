/**
 * JWT Payload Interface
 * Matches the JWT Token Structure from API Contract v1.1.0 Security Notes
 */
export interface JwtPayload {
  sub: string;              // User ID
  email: string;
  role: string;
  tenantId?: string;        // Null for platform admins
  permissions: string[];
  iat?: number;             // Issued at
  exp?: number;             // Expires at
}
