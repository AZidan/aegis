import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Auth E2E Test Suite
 *
 * These tests run against the full NestJS application stack and verify
 * end-to-end authentication flows as described in API Contract v1.1.0 Section 1.
 *
 * PREREQUISITES:
 * - PostgreSQL database running and accessible via DATABASE_URL
 * - Redis running and accessible via REDIS_URL (if caching is enabled)
 * - Environment variables: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
 *
 * These tests create/modify database records. Run against a test database only.
 */

describe('Auth E2E (api/auth/*)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test user credentials
  const testUser = {
    email: 'e2e-test@aegis.ai',
    password: 'E2eTestPass123!@',
    name: 'E2E Test User',
  };

  const testAdminMfa = {
    email: 'e2e-admin-mfa@aegis.ai',
    password: 'AdminMfa123!@#$',
    name: 'MFA Admin User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.refreshToken.deleteMany({
      where: {
        user: {
          email: { in: [testUser.email, testAdminMfa.email] },
        },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [testUser.email, testAdminMfa.email] } },
    });
    await app.close();
  });

  // =========================================================================
  // Flow 1: Login with valid credentials -> Access protected route
  // =========================================================================
  describe('Flow: Login -> Access Protected Route', () => {
    let accessToken: string;
    let refreshTokenValue: string;

    beforeAll(async () => {
      // Seed a test user with hashed password
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(testUser.password, 10);

      await prisma.user.create({
        data: {
          email: testUser.email,
          name: testUser.name,
          password: hashedPassword,
          role: 'tenant_admin',
          tenantId: null,
        },
      });
    });

    it('POST /api/auth/login - should return 200 with tokens and user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(HttpStatus.OK);

      // Assert response matches contract
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('expiresIn', 900);
      expect(response.body.user).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          email: testUser.email,
          name: testUser.name,
          role: 'tenant_admin',
        }),
      );

      accessToken = response.body.accessToken;
      refreshTokenValue = response.body.refreshToken;
    });

    it('GET /api/auth/me - should return 200 with user profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HttpStatus.OK);

      // Assert response matches contract
      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          email: testUser.email,
          name: testUser.name,
          role: 'tenant_admin',
          permissions: expect.any(Array),
          createdAt: expect.any(String),
        }),
      );

      // Verify createdAt is a valid ISO 8601 date
      expect(new Date(response.body.createdAt).toISOString()).toBe(
        response.body.createdAt,
      );
    });

    it('GET /api/auth/me - should return 401 without token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toHaveProperty('statusCode', 401);
    });
  });

  // =========================================================================
  // Flow 2: Login -> Refresh Token -> Access with new token
  // =========================================================================
  describe('Flow: Login -> Refresh -> Access', () => {
    let refreshTokenValue: string;
    let newAccessToken: string;

    it('should login and get refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(HttpStatus.OK);

      refreshTokenValue = response.body.refreshToken;
      expect(refreshTokenValue).toBeDefined();
    });

    it('POST /api/auth/refresh - should return new access token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: refreshTokenValue })
        .expect(HttpStatus.OK);

      // Assert matches contract: { accessToken, expiresIn }
      expect(response.body).toEqual({
        accessToken: expect.any(String),
        expiresIn: 900,
      });

      newAccessToken = response.body.accessToken;
    });

    it('GET /api/auth/me - should work with refreshed access token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(HttpStatus.OK);
    });
  });

  // =========================================================================
  // Flow 3: Logout -> Refresh token rejected
  // =========================================================================
  describe('Flow: Login -> Logout -> Refresh Rejected', () => {
    let accessToken: string;
    let refreshTokenValue: string;

    it('should login successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(HttpStatus.OK);

      accessToken = response.body.accessToken;
      refreshTokenValue = response.body.refreshToken;
    });

    it('POST /api/auth/logout - should return 204 No Content', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken: refreshTokenValue })
        .expect(HttpStatus.NO_CONTENT);
    });

    it('POST /api/auth/refresh - should reject revoked refresh token with 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: refreshTokenValue })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toHaveProperty('statusCode', 401);
      expect(response.body).toHaveProperty('message', 'Invalid or expired refresh token');
    });
  });

  // =========================================================================
  // Error Cases: Invalid credentials
  // =========================================================================
  describe('Error: Invalid Credentials', () => {
    it('POST /api/auth/login - should return 401 for wrong email', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@aegis.ai',
          password: 'SomePassword123!@',
        })
        .expect(HttpStatus.UNAUTHORIZED);

      // Assert matches contract error shape
      expect(response.body).toEqual(
        expect.objectContaining({
          statusCode: 401,
          message: 'Invalid credentials',
        }),
      );
    });

    it('POST /api/auth/login - should return 401 for wrong password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!@',
        })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // Error Cases: Validation failures
  // =========================================================================
  describe('Error: Validation Failures', () => {
    it('POST /api/auth/login - should return 422 for invalid email format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          password: 'ValidPass123!@#$',
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);

      // Assert matches contract error shape
      expect(response.body).toEqual(
        expect.objectContaining({
          statusCode: 422,
          error: 'Unprocessable Entity',
          message: 'Validation failed',
          details: expect.objectContaining({
            email: expect.any(Array),
          }),
        }),
      );
    });

    it('POST /api/auth/login - should return 422 for short password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'short',
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);

      expect(response.body.details).toHaveProperty('password');
    });

    it('POST /api/auth/login - should return 422 for empty body', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({})
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('POST /api/auth/refresh - should return 422 for empty refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: '' })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('POST /api/auth/mfa/verify - should return 422 for invalid TOTP code format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/mfa/verify')
        .send({
          email: 'admin@aegis.ai',
          totpCode: '12345', // only 5 digits
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);

      expect(response.body.details).toHaveProperty('totpCode');
    });

    it('POST /api/auth/login/oauth - should return 422 for invalid provider', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login/oauth')
        .send({
          provider: 'facebook',
          code: 'some-code',
          redirectUri: 'http://localhost:3001/callback',
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    });
  });

  // =========================================================================
  // Error Cases: Invalid / expired tokens
  // =========================================================================
  describe('Error: Invalid Tokens', () => {
    it('GET /api/auth/me - should return 401 for invalid JWT', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-jwt-token')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('GET /api/auth/me - should return 401 for malformed Authorization header', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'NotBearer some-token')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('POST /api/auth/refresh - should return 401 for non-existent refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'completely-fabricated-token' })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.message).toBe('Invalid or expired refresh token');
    });

    it('POST /api/auth/logout - should return 401 without access token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .send({ refreshToken: 'some-token' })
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  // =========================================================================
  // Response Shape Validation
  // =========================================================================
  describe('Response Shape Compliance', () => {
    it('login response should match API contract exactly', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(HttpStatus.OK);

      const body = response.body;

      // Verify all contract-required fields exist
      expect(typeof body.accessToken).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
      expect(typeof body.expiresIn).toBe('number');
      expect(body.expiresIn).toBe(900);

      // User object
      expect(typeof body.user.id).toBe('string');
      expect(typeof body.user.email).toBe('string');
      expect(typeof body.user.name).toBe('string');
      expect(['platform_admin', 'tenant_admin', 'tenant_member']).toContain(
        body.user.role,
      );

      // No unexpected top-level keys
      const allowedKeys = ['accessToken', 'refreshToken', 'expiresIn', 'user'];
      Object.keys(body).forEach((key) => {
        expect(allowedKeys).toContain(key);
      });
    });

    it('refresh response should match API contract exactly', async () => {
      // Login first
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      // Refresh
      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(HttpStatus.OK);

      const body = response.body;

      // Contract: { accessToken: string; expiresIn: number }
      expect(typeof body.accessToken).toBe('string');
      expect(typeof body.expiresIn).toBe('number');
      expect(body.expiresIn).toBe(900);

      // Should only have these two keys
      expect(Object.keys(body).sort()).toEqual(['accessToken', 'expiresIn']);
    });

    it('GET /api/auth/me response should match API contract exactly', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(HttpStatus.OK);

      const body = response.body;

      // Contract fields
      expect(typeof body.id).toBe('string');
      expect(typeof body.email).toBe('string');
      expect(typeof body.name).toBe('string');
      expect(typeof body.role).toBe('string');
      expect(Array.isArray(body.permissions)).toBe(true);
      expect(typeof body.createdAt).toBe('string');
    });

    it('error response should match API contract format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'bad-email',
          password: 'x',
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);

      const body = response.body;

      // Contract error format: { statusCode, error, message, details?, timestamp?, path? }
      expect(typeof body.statusCode).toBe('number');
      expect(typeof body.error).toBe('string');
      expect(typeof body.message).toBe('string');
    });
  });

  // =========================================================================
  // Admin Auth Endpoints
  // =========================================================================
  describe('Admin Auth (api/admin/auth/*)', () => {
    it('POST /api/admin/auth/login - should return 403 for non-admin user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/admin/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body).toEqual(
        expect.objectContaining({
          statusCode: 403,
          message: 'Requires platform_admin role',
        }),
      );
    });

    it('POST /api/admin/auth/login - should return 422 for invalid data', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/auth/login')
        .send({ email: 'bad', password: 'x' })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('POST /api/admin/auth/login - should return 401 for non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/admin/auth/login')
        .send({
          email: 'nonexistent-admin@aegis.ai',
          password: 'SomePassword123!@',
        })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toEqual(
        expect.objectContaining({
          statusCode: 401,
          message: 'Invalid credentials',
        }),
      );
    });

    it('POST /api/admin/auth/mfa/verify - should return 422 for invalid TOTP', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/auth/mfa/verify')
        .send({ email: 'admin@aegis.ai', totpCode: '123' })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    });
  });
});
