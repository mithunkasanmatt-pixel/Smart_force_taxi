import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../lib/auth-utils';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const adminEmail = 'admin@smartforce.com';
  const adminPassword = 'Smart@4321admin';

  // Upsert Admin user (creates if missing, updates password & role if exists without deleting existing data)
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: hashPassword(adminPassword),
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
    },
    create: {
      email: adminEmail,
      password: hashPassword(adminPassword),
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
      employeeId: 'EMP-001',
      phone: '+15550100',
      status: 'OFFLINE',
    },
  });

  console.log('Admin User configured successfully:', admin.email);
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
