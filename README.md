# QR-Dine — Smart Restaurant Ordering System

VERCEL-DEPLOYMENT:https://qr-dine-in-osv6.vercel.app/
Admin:
 usernmae:admin@qrdine.com
Admin@123456

kitchen:
password:123456

A QR-based dine-in ordering system built with **Next.js 14**, **Prisma**, **Supabase**, and **Tailwind CSS**.

## Features

- **QR Code Table Ordering** — Customers scan a QR code to browse the menu and place orders
- **Real-time Kitchen Dashboard** — Live order queue with Kanban-style columns (Placed → Confirmed → Preparing → Ready)
- **Admin Panel** — Full management dashboard for menu, tables, orders, kitchen staff, and settings
- **Offline Resilience** — Pending action queue, online/offline detection, fallback polling
- **PIN-based Kitchen Login** — Simple 4-digit PIN authentication for kitchen staff
- **Payment Tracking** — UPI, Cash, and Pay-at-Counter payment methods

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL (via Supabase) |
| ORM | Prisma 5 |
| Realtime | Supabase Realtime |
| Auth | JWT (jose, Edge-compatible) |
| Styling | Tailwind CSS |
| Validation | Zod |
| Data Fetching | SWR |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `DIRECT_URL` | Direct connection URL (for migrations) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `JWT_SECRET` | Secret for JWT signing (min 32 chars) |
| `NEXT_PUBLIC_APP_URL` | Your app URL (default: http://localhost:3000) |

### 3. Setup Database

```bash
npm run setup
```

This generates the Prisma client, pushes the schema to your database, and seeds demo data.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Default Credentials

| Role | Login |
|------|-------|
| Admin | `admin@qrdine.com` / `admin123` |
| Kitchen | PIN: `1234` |

## Project Structure

```
src/
├── app/
│   ├── admin/           # Admin dashboard, menu, tables, orders, staff, settings
│   ├── api/             # 20+ API routes
│   ├── kitchen/         # Kitchen login + order queue dashboard
│   ├── table/[tableId]/ # Customer flow: menu → cart → order → checkout → thank-you
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Landing page
├── components/          # Shared UI components
├── hooks/               # Custom hooks (cart, realtime, online status, pending actions)
└── lib/                 # Utilities (prisma, supabase, auth, validations, api helpers)
prisma/
├── schema.prisma        # Database schema (10 models, 6 enums)
└── seed.ts              # Demo data seeder
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run setup` | Full setup (generate + push + seed) |

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/admin-login` | Admin email/password login |
| POST | `/api/auth/kitchen-login` | Kitchen PIN login |
| GET | `/api/auth/me` | Validate token |
| GET/POST | `/api/tables` | List/create tables |
| GET/PATCH/DELETE | `/api/tables/[tableId]` | Table CRUD |
| GET | `/api/tables/[tableId]/qr` | Generate QR code |
| POST | `/api/sessions` | Create table session |
| GET/PATCH | `/api/sessions/[sessionId]` | Session management |
| GET | `/api/sessions/[sessionId]/validate` | Quick session validation |
| GET/POST | `/api/categories` | List/create categories |
| PATCH | `/api/categories/[categoryId]` | Update category |
| GET/POST | `/api/menu` | List/create menu items |
| GET/PATCH/DELETE | `/api/menu/[itemId]` | Menu item CRUD |
| PATCH | `/api/menu/[itemId]/availability` | Toggle availability |
| GET/POST | `/api/orders` | List/create orders |
| GET | `/api/orders/[orderId]` | Order details |
| PATCH | `/api/orders/[orderId]/status` | Update order status |
| POST | `/api/payments/initiate` | Initiate payment |
| POST | `/api/payments/verify` | Verify payment |
| GET | `/api/payments/[paymentId]` | Payment status |
| GET | `/api/admin/metrics` | Dashboard metrics |
| GET/POST | `/api/admin/kitchen-staff` | Kitchen staff management |
| DELETE | `/api/admin/kitchen-staff/[staffId]` | Deactivate staff |
| GET | `/api/health` | Health check |
