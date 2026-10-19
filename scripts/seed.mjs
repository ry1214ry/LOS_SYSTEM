// scripts/seed.mjs
//
// Idempotently populates the RBAC matrix (permissions, roles,
// role_permissions) and, when SEED_SUPER_ADMIN_* is set, the initial
// Super Administrator account.
//
// Single source of truth: it imports the constants from the COMPILED build,
// so run `nest build` first (the `npm run seed` script does this for you).
//
// Usage:  npm run seed
//
// Expects the schema to exist already. Start the API once with
// DB_SYNCHRONIZE=true (or apply migrations) before the first seed.
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import pg from 'pg';

import { PermissionCatalog } from '../dist/auth/config/permission-catalog.config.js';
import {
  RoleDescriptions,
  RolePermissionsMap,
} from '../dist/auth/config/role-permissions.config.js';
import { SystemRole } from '../dist/auth/enums/role.enum.js';

try {
  process.loadEnvFile('.env');
} catch {
  // no .env file — rely on the process environment
}

const client = new pg.Client({
  ...(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        user: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE ?? 'LOS-SYSTEM',
      }),
  ...(String(process.env.DB_SSL).toLowerCase() === 'true'
    ? { ssl: { rejectUnauthorized: process.env.DB_REJECT_UNAUTHORIZED !== 'false' } }
    : {}),
});

async function assertSchemaExists() {
  const { rows } = await client.query(
    `SELECT to_regclass('public.permissions') AS permissions,
            to_regclass('public.roles')       AS roles`,
  );
  if (!rows[0]?.permissions || !rows[0]?.roles) {
    throw new Error(
      'Tables "permissions"/"roles" not found. Start the API once with DB_SYNCHRONIZE=true ' +
        '(or apply database migrations) before running the seed.',
    );
  }
}

async function seedPermissions() {
  for (const definition of PermissionCatalog) {
    await client.query(
      `INSERT INTO permissions (id, action, resource, label, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (action) DO UPDATE
         SET resource = EXCLUDED.resource,
             label = EXCLUDED.label,
             description = EXCLUDED.description`,
      [
        randomUUID(),
        definition.action,
        definition.resource,
        definition.label,
        definition.description,
      ],
    );
  }
}

async function seedRoles() {
  const { rows: permissionRows } = await client.query('SELECT id, action FROM permissions');
  const permissionIdByAction = new Map(permissionRows.map((r) => [r.action, r.id]));

  for (const roleName of Object.values(SystemRole)) {
    const { rows } = await client.query(
      `INSERT INTO roles (id, name, description, "isSystem")
       VALUES ($1, $2, $3, true)
       ON CONFLICT (name) DO UPDATE
         SET description = EXCLUDED.description
       RETURNING id`,
      [randomUUID(), roleName, RoleDescriptions[roleName]],
    );
    const roleId = rows[0].id;

    // Replace the grant set atomically so removals in the matrix take effect.
    await client.query('DELETE FROM role_permissions WHERE "roleId" = $1', [roleId]);
    for (const action of RolePermissionsMap[roleName]) {
      const permissionId = permissionIdByAction.get(action);
      if (!permissionId) {
        throw new Error(`Permission '${action}' was not inserted; aborting.`);
      }
      await client.query(
        `INSERT INTO role_permissions ("roleId", "permissionId") VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [roleId, permissionId],
      );
    }

    console.log(
      `  role '${roleName}' → ${RolePermissionsMap[roleName].length} permission(s)`,
    );
  }
}

async function seedSuperAdmin() {
  const email = (process.env.SEED_SUPER_ADMIN_EMAIL ?? '').toLowerCase().trim();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? '';

  if (!email || !password) {
    console.log('  (skipped: SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD not set)');
    return;
  }
  if (password.length < 8) {
    throw new Error('SEED_SUPER_ADMIN_PASSWORD must be at least 8 characters long.');
  }

  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  const passwordHash = await bcrypt.hash(password, rounds);

  const { rows } = await client.query(
    `INSERT INTO users (id, email, "passwordHash", "roleId", "isActive", "mustChangePassword", "passwordChangedAt")
     VALUES (
       $1, $2, $3,
       (SELECT id FROM roles WHERE name = $4),
       true, false, now()
     )
     ON CONFLICT (email) DO UPDATE
       SET "passwordHash" = EXCLUDED."passwordHash",
           "roleId"       = EXCLUDED."roleId",
           "isActive"     = true
     RETURNING id, email`,
    [randomUUID(), email, passwordHash, SystemRole.SUPER_ADMINISTRATOR],
  );

  console.log(`  super administrator ready: ${rows[0].email}`);
}

async function main() {
  await client.connect();
  try {
    await assertSchemaExists();
    console.log('Seeding RBAC matrix…');
    await seedPermissions();
    await seedRoles();
    console.log('Seeding bootstrap user…');
    await seedSuperAdmin();
    console.log('Seed complete.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Seed failed: ${error.message}`);
  process.exit(1);
});
