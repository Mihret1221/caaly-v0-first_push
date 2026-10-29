# Cabit Backend

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

</div>

Cabit Backend is a TypeScript/Express API for a QR-basedride and fare management platform. It handles user onboarding, KYC, payments, QR code-based trip lifecycle management, and admin operations for a transport service.

## Overview

This backend supports the main operational flow of a ride system:

- User registration and authentication
- OTP-based password reset and account recovery
- JWT-based authorization with role checks
- Fayda-powered KYC flow
- QR code generation and validation for trip devices
- Trip start/stop tracking and fare calculation
- Payment initiation through Chapa and Telebirr
- Admin and super-admin access controls
- Background cleanup jobs and token invalidation

## Architecture

The system is organized around a modular Express API with a PostgreSQL + TypeORM data layer.

```text
src/
├── config/
│   └── data-source.ts
├── controllers/
│   ├── admin.controller.ts
│   ├── auth.controller.ts
│   ├── kyc.controller.ts
│   ├── payment.controller.ts
│   ├── qr.controller.ts
│   ├── trip.controller.ts
│   └── user.controller.ts
├── helpers/
│   ├── buildFaydaAuthorizationUrl.ts
│   ├── generate_keys.ts
│   └── validator.ts
├── middleware/
│   └── auth.middleware.ts
├── models/
│   ├── active_token.model.ts
│   ├── admins.model.ts
│   ├── kyc_session.model.ts
│   ├── login_attempts.model.ts
│   ├── otp.model.ts
│   ├── payments.model.ts
│   ├── qr_codes.model.ts
│   ├── settings.model.ts
│   ├── trips.model.ts
│   └── users.model.ts
├── routes/
│   ├── admin.routes.ts
│   ├── auth.routes.ts
│   ├── kyc.routes.ts
│   ├── payment.routes.ts
│   ├── qr.routes.ts
│   ├── trip.routes.ts
│   └── user.routes.ts
├── services/
│   ├── cleanup.service.ts
│   ├── geezsms.service.ts
│   └── payment.service.ts
├── utils/
│   └── jwt.ts
├── index.ts
└── ...
```

## Features

### Authentication and Users

- Phone and email validation
- Secure password hashing with bcrypt
- JWT-based session management
- Login throttling and lockout logic
- OTP-based password reset flow
- Admin role support: `admin`, `subadmin`, `superadmin`
- Soft-deleted user handling

### KYC Integration

- Fayda authorization URL generation
- PKCE-based OAuth flow
- Callback handling for KYC completion
- KYC session persistence
- JWKS endpoint exposure for verification workflows

### Trip and QR Logic

- Unique QR generation for devices
- Start trip and end trip operations
- Active trip checks and conflict prevention
- Fare calculation based on trip duration and configured fare rate
- Trip history and reporting for users and admins

### Payments

- Payment initiation using Chapa or Telebirr
- Callback handling for third-party providers
- Verification hooks for completed payments
- Mock fallback behavior when credentials are not configured

### Admin Operations

- Admin registration and login
- Admin password changes and logout
- Super-admin protected user management endpoints
- Admin access to trip and QR-related resources

## Tech Stack

- Node.js
- TypeScript
- Express.js
- TypeORM
- PostgreSQL
- JWT
- bcrypt
- QRCode
- Axios
- node-cron
- Helmet + CORS

## Prerequisites

Before running the project, ensure you have:

- Node.js 18 or newer
- PostgreSQL installed and running
- Environment access to any provider credentials for Chapa, Telebirr, and Fayda if you plan to use live integrations

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root.

3. Start the app in development mode:

```bash
npm run dev
```

4. Or build and run in production mode:

```bash
npm run build
npm start
```

## Environment Variables

Example `.env` configuration:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=your_password
DB_NAME=cabit_db

JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=24h
API_URL=http://localhost:3000

CHAPA_API_URL=https://api.chapa.co/v1
CHAPA_SECRET_KEY=your_chapa_secret

TELEBIRR_API_URL=https://app.telebirr.et/api
TELEBIRR_APP_ID=your_telebirr_app_id
TELEBIRR_APP_KEY=your_telebirr_app_key

FAYDA_AUTH_URL=https://example-fayda-auth-url
FAYDA_CLIENT_ID=your_fayda_client_id
FAYDA_REDIRECT_URI=http://localhost:3000/api/kyc/callback
FAYDA_TOKEN_ENDPOINT=https://example-fayda-token-endpoint
```

> Some provider integrations include mock behavior when credentials are absent. For production, replace all placeholders with valid secrets.

## Database Setup

The project connects to PostgreSQL through TypeORM using `src/config/data-source.ts`.

Current config:

- Database type: PostgreSQL
- Synchronization: enabled (`synchronize: true`)
- Entities loaded from `src/models/*.{ts,js}`

For production deployment, it is recommended to switch to migrations and disable automatic schema synchronization.

## API Routes

### Authentication

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/forgot-password
POST /api/auth/verify-otp
POST /api/auth/set-new-password
POST /api/auth/change-password
POST /api/auth/logout
```

### KYC

```http
GET /api/kyc/init
GET /api/kyc/callback
GET /api/kyc/.well-known/jwks.json
```

### Trips

```http
POST /api/trip/start
GET /api/trip/history
GET /api/trip/active-trips
GET /api/trip/all-trips
POST /api/trip/stop
```

### Admin

```http
POST /api/admin/register
POST /api/admin/login
POST /api/admin/change-password
POST /api/admin/logout
```

### Payment

```http
POST /api/payment/initiate
POST /api/payment/callback/chapa
POST /api/payment/callback/telebirr
```

### QR Codes

```http
POST /api/qr/generate
GET /api/qr/list
```

### Users

```http
GET /api/users
GET /api/users/:id
DELETE /api/users/:id
POST /api/users/restore/:id
```

## Authentication

Protected routes use a bearer token:

```http
Authorization: Bearer <token>
```

The middleware validates the JWT and checks whether the token is still active and permitted for the requested role.

## Notes and Caveats

- A cron job is configured in `src/index.ts` for cleanup work.
- Some payment and KYC flows are still partially mocked or require provider-specific implementation details.
- The project is suitable for active development, but production hardening is recommended before deployment.

## License

This project is licensed under the ISC license, as declared in `package.json`.

## Maintainer

No author metadata is currently defined in `package.json`. If this project is meant for team ownership, update the `author` field and add a maintainer section accordingly.
