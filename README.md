# Smart Force Taxi - Fleet Management System

[![Next.js](https://img.shields.io/badge/Next.js-16.2.12-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.4-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19.3-2D3748?logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

**Smart Force Taxi** is a full-stack, enterprise-grade Fleet Management & Chauffeur Logistics platform built with Next.js 16 (App Router), React 19, Prisma ORM, PostgreSQL (Neon Database ready), NextAuth.js v5, Nodemailer, and Twilio.

The platform streamlines corporate transportation, fleet vehicle allocation, driver shift logging, financial earnings calculation, tax deductions, and automated notifications.

---

## 💡 System Features & Capabilities

- **🌐 Multi-Language Support (`en` & `fi`)**: Complete English and Finnish internationalization with seamless theme toggling (Light/Dark glassmorphic UI).
- **🔒 Role-Based Access Control (RBAC)**: Distinct workflows for `SUPER_ADMIN`, `TRANSPORT_MANAGER`, and `DRIVER`.
- **🚗 Vehicle Fleet & Smart Slot Booking**:
  - Full vehicle registry (plate number, registration, odometer, FC, pollution, and insurance expiration tracking).
  - Immediate Car Booking ("Book & Start Now") and Scheduled Slot Bookings (14-day timeline grid, daily, monthly, and yearly views).
  - Permanent vehicle allocation vs. temporary slot bookings.
  - Conflict-free time slot validation and double-verified deletion safety protocols.
- **👨‍✈️ Driver Portal & Duty Shifts**:
  - Live shift clock-in / clock-out timer.
  - Active trip execution, route pick-up, destination navigation, and issue flagging.
  - Profile and document management (license numbers, SSN, emergency contacts).
- **📸 Weekly Work Log Submissions**:
  - Drivers upload proof screenshots with custom logs.
  - Automatic email notifications dispatched immediately to admins.
- **💰 Earnings & Tax Calculation Subsystem**:
  - Automated formula: `13.5% Tax` deducted from total trip revenue -> Remaining amount split into `45% Driver Share` and `55% Company Share`.
  - Admin payroll module: monthly salary breakdown, allowances, deductions, net salary calculation, and CSV export.
- **📈 Performance Metrics & Rewards**:
  - Booked vs. actual trip hours analysis, efficiency ratios, performance scoring, and admin reward verification.
- **🔔 Automated Multi-Channel Communication**:
  - **Driver Onboarding**: Automatic credential delivery via SMTP email and Twilio WhatsApp.
  - **Password Reset**: 6-digit OTP verification email (10-minute expiry).
  - **Booking Notifications**: Instant email confirmations, cancellations, and vehicle allocation changes.
  - **Daily Available Slots Broadcast**: Daily automated email summarizing tomorrow's free vehicle slots.
  - **Taxi License Expiry Alerts**: Automated 6-month warning window scan running twice daily (5:00 AM & 5:00 PM) with in-app badges and urgent email alerts.

---

## 🏗️ Architecture & Data Model

```mermaid
erDiagram
    User ||--o{ Trip : "DriverTrips"
    User ||--o{ WeeklyLog : "driver"
    User ||--o{ DriverEarning : "driver"
    User ||--o{ Notification : "user"
    User ||--o| DriverSalary : "driver"
    User ||--o{ PayrollRecord : "driver"
    User ||--o{ DriverPerformance : "driver"
    User }|--o| Vehicle : "assignedVehicle"
    Vehicle ||--o{ Trip : "vehicle"

    User {
        string id PK
        string email UK
        string name
        enum role "SUPER_ADMIN | TRANSPORT_MANAGER | DRIVER"
        string employeeId UK
        enum status "AVAILABLE | ON_TRIP | ON_BREAK | OFF_DUTY | OFFLINE"
        datetime licenseExpiry
        string assignedVehicleId FK
    }

    Vehicle {
        string id PK
        string vehicleNumber UK
        string brand
        string model
        enum status "AVAILABLE | ASSIGNED | ON_TRIP | MAINTENANCE | OFFLINE"
        datetime insuranceExpiry
        datetime fcExpiry
        datetime pollutionExpiry
        int odometer
    }

    Trip {
        string id PK
        string tripNumber UK
        string pickup
        string destination
        datetime startTime
        datetime endTime
        enum status "PENDING | ASSIGNED | ACCEPTED | IN_PROGRESS | COMPLETED | CANCELLED"
        string driverId FK
        string vehicleId FK
    }

    DriverEarning {
        string id PK
        string driverId FK
        float totalEarnings
        float taxRate "13.5%"
        float taxAmount
        float remainingAmount
        float driverShare "45%"
        float companyShare "55%"
        datetime date
    }
```

---

## 🔄 End-to-End System Workflows

### 1. Driver Onboarding Workflow
```mermaid
sequenceDiagram
    autonumber
    actor Driver/Admin
    participant Auth as Auth API / NextAuth
    participant DB as PostgreSQL (Prisma)
    participant SMTP as Nodemailer SMTP
    participant Twilio as Twilio WhatsApp

    Driver/Admin->>Auth: Register New Driver Account
    Auth->>DB: Create User Record (Role: DRIVER, Status: OFFLINE)
    Auth->>SMTP: Send Welcome Email with Credentials & Portal Link
    Auth->>Twilio: Send WhatsApp Notification with Login Details (Optional)
    Auth-->>Driver/Admin: Account Created Successfully
```

### 2. Vehicle Slot Booking & Trip Execution Workflow
```mermaid
sequenceDiagram
    autonumber
    actor Driver
    participant Portal as Driver Portal
    participant API as /api/bookings
    participant DB as Prisma DB
    participant SMTP as Nodemailer SMTP

    Driver->>Portal: Browse Available Vehicles / Time Slots
    Driver->>Portal: Select Vehicle, Pickup, Destination, Start & End Time
    Portal->>DB: Check for Slot Overlaps & Create Trip Record (Status: PENDING/ACCEPTED)
    Portal->>SMTP: Dispatch Booking Confirmation Email to Driver
    Driver->>Portal: Clock-In & Start Journey (Trip Status -> IN_PROGRESS, Driver -> ON_TRIP)
    Driver->>Portal: Complete Trip (Trip Status -> COMPLETED, Vehicle -> AVAILABLE)
```

### 3. Financial Calculation & Tax Deduction Workflow
```mermaid
flowchart TD
    A[Driver Submits / System Logs Total Trip Revenue] --> B[Calculate 13.5% Tax Deduction]
    B --> C[Remaining Revenue = Total Revenue - Tax Amount]
    C --> D[Calculate Driver Share = 45% of Remaining Revenue]
    C --> E[Calculate Company Share = 55% of Remaining Revenue]
    D --> F[Store in DriverEarning Record]
    E --> F
    F --> G[Driver Portal Displays Net Earnings]
    F --> H[Admin Earnings Dashboard Generates Monthly Payroll & CSV Export]
```

### 4. License Expiry & Daily Broadcast Automation
```mermaid
flowchart TD
    A[Cron Job / Scheduled API Call] --> B{Determine Execution Type}
    B -->|/api/notifications/daily| C[Query Vehicles & Calculate Tomorrow's Free Slots]
    C --> D[Broadcast Email to All Active Drivers]
    B -->|/api/notifications/check-expiry| E[Scan Drivers for License Expiry Date]
    E --> F{License Expiry <= 6 Months?}
    F -->|Yes| G[Check 5 AM / 5 PM Dispatch Window]
    G --> H[Create In-App Notification Badge & Send Urgent Email Alert]
    F -->|No| I[Skip Notification]
```

---

## 🛠️ Technology Stack & Dependencies

| Layer | Technologies Used |
|---|---|
| **Framework** | Next.js 16.2.12 (App Router with Turbopack & Webpack) |
| **UI & Styling** | React 19, Tailwind CSS v4, Lucide React, Framer Motion |
| **State & Tables** | React Hook Form, Zod v4, TanStack React Table |
| **Database & ORM** | PostgreSQL, Prisma ORM 6.19.3, `@prisma/adapter-neon` |
| **Authentication** | NextAuth.js v5 (Credentials Provider, JWT Strategy) |
| **Notifications** | Nodemailer (SMTP), Twilio API (WhatsApp) |
| **Analytics/Charts**| Recharts 3.x |

---

## 🚀 Environment Setup & Installation

### 1. Prerequisites
- Node.js 20+ installed
- PostgreSQL database (Local or Neon Serverless)

### 2. Environment Variables (`.env`)
Create a `.env` file in the root directory with the following keys:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/fleet_db?schema=public"
NEXTAUTH_SECRET="your-super-secret-nextauth-key"
NEXTAUTH_URL="http://localhost:3000"

# SMTP Email Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM='"Smart Force Taxi" <noreply@smartforcetaxi.com>'

# Twilio WhatsApp Integration (Optional)
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_twilio_auth_token"
TWILIO_FROM_WHATSAPP="whatsapp:+14155238886"

# Cron API Secret Security
CRON_SECRET="your-cron-secret-key"
```

### 3. Database Migration & Setup
```bash
# Install dependencies
npm install

# Run Prisma database migrations
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate

# Seed initial admin and test data
npm run seed # or npx tsx prisma/seed.ts
```

### 4. Running the Application
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

---

## 📁 Key File Map

- **`prisma/schema.prisma`**: Comprehensive database schema definitions (`User`, `Vehicle`, `Trip`, `WeeklyLog`, `DriverEarning`, `DriverSalary`, `PayrollRecord`, `DriverPerformance`, `Notification`).
- **`lib/auth.ts` & `auth.config.ts`**: NextAuth.js configuration, credentials authorization, and JWT session handling.
- **`lib/notifications.ts`**: Centralized email and WhatsApp dispatch functions.
- **`lib/tax-calculator.ts`**: Tax deduction (13.5%) and revenue split (45/55) logic.
- **`lib/translations.ts`**: Complete English (`en`) and Finnish (`fi`) translation dictionary.
- **`utils/export-csv.ts`**: Browser-compatible CSV export helper.
- **`app/admin/*`**: Super Admin and Transport Manager dashboards, vehicle fleet management, driver registries, earnings, schedule timelines, and weekly logs.
- **`app/driver/*`**: Driver portal for shift clocking, vehicle slot booking, weekly log uploads, earnings breakdown, and profile settings.
- **`scripts/send-daily-email.ts`**: CLI script for triggering the daily vehicle slot availability broadcast email.

---

## 📜 License
This project is proprietary software developed for Smart Force Taxi Fleet Management Systems. All rights reserved.
