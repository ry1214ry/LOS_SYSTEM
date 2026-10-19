import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter.js';

// Load .env so the seeded Super Administrator credentials are available.
try {
  process.loadEnvFile('.env');
} catch {
  // no .env file — rely on the process environment
}

/**
 * End-to-end tests for the auth + restricted user-provisioning flow that the
 * global JwtAuthGuard/RolesGuard protect.
 *
 * Pre-requisites: the database schema exists (DB_SYNCHRONIZE=true on first
 * boot) and the RBAC matrix + Super Administrator have been seeded
 * (`npm run seed` or SEED_ON_BOOT=true).
 *
 * Run with:  npm run test:e2e
 */
describe('Auth + Users (e2e)', () => {
  let app: INestApplication;
  let http: Parameters<typeof request>[0];
  let token = '';
  const createdEmails: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirror the global pipeline configured in src/main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter(false));
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    const dataSource = app.get(DataSource);
    if (createdEmails.length > 0) {
      await dataSource.query('DELETE FROM users WHERE email = ANY($1)', [createdEmails]);
    }
    await app.close();
  });

  it('POST /users/provision without a token → 401', async () => {
    await request(http)
      .post('/users/provision')
      .send({ email: 'nobody@example.com', role: 'Approver' })
      .expect(401);
  });

  it('POST /auth/login as the seeded Super Administrator → 200 + token', async () => {
    const res = await request(http)
      .post('/auth/login')
      .send({
        email: process.env.SEED_SUPER_ADMIN_EMAIL,
        password: process.env.SEED_SUPER_ADMIN_PASSWORD,
      })
      .expect(200);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.role).toBe('Super Administrator');
    // Refresh token must be an HttpOnly cookie, never in the JSON body.
    const cookies = res.headers['set-cookie'] ?? [];
    expect(String(cookies)).toContain('refresh_token=');
    expect(String(cookies)).toContain('HttpOnly');
    expect(res.body.refreshToken).toBeUndefined();

    token = res.body.accessToken;
  });

  it('POST /users/provision → 201, returns a temp password, never leaks the hash', async () => {
    const email = `e2e-${Date.now()}@example.com`;
    createdEmails.push(email);

    const res = await request(http)
      .post('/users/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({ email, role: 'Approver' })
      .expect(201);

    expect(res.body.user).toMatchObject({ email, role: 'Approver', mustChangePassword: true });
    expect(res.body.temporaryPassword).toBeTruthy();
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('POST /users/provision with a duplicate email → 409', async () => {
    const email = `e2e-dup-${Date.now()}@example.com`;
    createdEmails.push(email);
    const body = { email, role: 'Approver' };

    await request(http)
      .post('/users/provision')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);
    await request(http)
      .post('/users/provision')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(409);
  });

  it('POST /users/provision with an invalid body → 400 (error envelope)', async () => {
    const res = await request(http)
      .post('/users/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'not-an-email', role: 'Not A Role' })
      .expect(400);

    expect(res.body).toMatchObject({ statusCode: 400, path: '/users/provision' });
    expect(res.body.timestamp).toBeTruthy();
  });

  it('GET /health/live → 200 (public)', async () => {
    const res = await request(http).get('/health/live').expect(200);
    expect(res.body.status).toBe('ok');
  });
});
