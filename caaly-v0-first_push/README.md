
# Cabit Backend

Cabit Backend is a TypeScript/Express API for a QR-based transport and fare management system. It powers user registration and authentication, QR-driven trip lifecycle management, KYC verification, payment initiation, and administrative controls for a cab or ride service.

The project is designed around a PostgreSQL + TypeORM data layer and exposes REST endpoints for both end users and internal administrators.

## Overview

This backend supports the core flow of a ride service:

- User signup and login with phone-based authentication
- Password reset and OTP verification
- JWT-based protected routes
- KYC onboarding with Fayda integration
- QR code generation for devices/vehicles
- Trip start and stop tracking
- Fare calculation and trip history
- Payment initiation for Chapa and Telebirr
- Admin and super-admin access control
- Scheduled cleanup tasks and account/token management

## Tech Stack

- Node.js
- TypeScript
- Express.js
- TypeORM
- PostgreSQL
- JWT (jsonwebtoken)
- bcrypt
- qrcode
- Axios
- node-cron
- Helmet and CORS for API hardening

## Project Structure

```text
src/
  config/
    data-source.ts
  controllers/
    admin.controller.ts
    auth.controller.ts
    kyc.controller.ts
    payment.controller.ts
    qr.controller.ts
    trip.controller.ts
    user.controller.ts
  helpers/
    buildFaydaAuthorizationUrl.ts
    generate_keys.ts
    validator.ts
  middleware/
    auth.middleware.ts
  models/
    active_token.model.ts
    admins.model.ts
    kyc_session.model.ts
    login_attempts.model.ts
    otp.model.ts
    payments.model.ts
    qr_codes.model.ts
    settings.model.ts
    trips.model.ts
    users.model.ts
  routes/
    admin.routes.ts
    auth.routes.ts
    kyc.routes.ts
    payment.routes.ts
    qr.routes.ts
    trip.routes.ts
    user.routes.ts
  services/
    cleanup.service.ts
    geezsms.service.ts
    payment.service.ts
  utils/
    jwt.ts
```

## Core Features

### Authentication and Users

- User registration with validation for email, password, and phone number
- Login with account lockout after repeated failed attempts
- JWT generation with active token tracking
- OTP-based password reset flow
- Admin roles: admin, subadmin, superadmin
- Soft-deleted user handling for inactive accounts

### KYC

- Fayda authorization URL generation
- PKCE-based OAuth flow support
- Callback handling for KYC completion
- User verification and OTP sending to the phone number after KYC
- JWKS route exposed for external verification needs

### Trips and QR Management

- Device QR registration with unique QR values
- QR-based trip start confirmation
- Active trip tracking
- Trip stop and fare calculation using configured fare rate
- User trip history and admin trip reporting

### Payments

- Payment initiation via Chapa or Telebirr
- Callback endpoints for provider responses
- Payment verification hooks
- Mock fallback behavior when provider credentials are not configured

### Admin Tools

- Admin registration and login
- Admin password changes and logout
- Super-admin restrictions for sensitive user actions
- Admin-only access to trip reports and QR management

## Prerequisites

Before running the project, make sure you have:

- Node.js 18+
- PostgreSQL running locally or in a managed environment
- Access to provider credentials for Chapa/Telebirr and Fayda if you are using live integrations

## Environment Variables

Create a `.env` file in the project root with values similar to the following:

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

Note: Some payment and KYC integrations include mock behavior if credentials are not provided. For production, replace all placeholder values with valid secrets.

## Installation

```bash
npm install
```

## Run the API

Development mode:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

## Database Setup

The backend uses TypeORM with PostgreSQL. The connection is configured in `src/config/data-source.ts`.

Current configuration:

- Database type: PostgreSQL
- Synchronization: enabled (`synchronize: true`)
- Entities: loaded from `src/models/*.{ts,js}`

Important: for production, it is recommended to disable `synchronize` and run migrations instead of auto-creating schema structure.

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

Protected endpoints require a bearer token:

```http
Authorization: Bearer <token>
```

The middleware verifies the JWT and checks if the token is still valid and present in the database token registry. Role-based access is also enforced for admin and super-admin routes.

## Notes and Caveats

- This project uses a scheduled cron job for cleanup tasks, defined in `src/index.ts`.
- Some payment integrations return mock URLs if the provider credentials are missing.
- The codebase is set up for rapid development and may require production hardening before deployment.
- Some controller implementations are still partial and may need additional provider-specific integration work for live production use.

## License

This project is currently licensed under `ISC` as defined in `package.json`.

## Contact / Maintainer

This repository does not currently define a maintainer in the package metadata. Update the author field in `package.json` and add project ownership details if needed.

