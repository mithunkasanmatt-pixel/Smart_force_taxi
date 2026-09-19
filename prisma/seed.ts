import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../lib/auth-utils';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data in order of dependency
  await prisma.notification.deleteMany({}).catch(() => {});
  await prisma.payrollRecord.deleteMany({}).catch(() => {});
  await prisma.driverSalary.deleteMany({}).catch(() => {});
  await prisma.driverEarning.deleteMany({}).catch(() => {});
  await prisma.weeklyLog.deleteMany({}).catch(() => {});
  await prisma.trip.deleteMany({}).catch(() => {});
  await prisma.vehicle.deleteMany({}).catch(() => {});
  await prisma.user.deleteMany({}).catch(() => {});

  console.log('Deleted existing records.');

  // Create Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@mattengg.com',
      password: hashPassword('Matt@4321admin'),
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
      employeeId: 'EMP-001',
      phone: '+15550100',
      status: 'OFFLINE',
    },
  });
  console.log('Created Admin User:', admin.email);



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
