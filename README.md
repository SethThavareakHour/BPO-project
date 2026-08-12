# Advisor Review System

Next.js app for advisors to manage student projects, scan Google Drive folders for SRS/OPPM documents, run AI reviews, and send feedback by email.

## Prerequisites

- **Node.js** 20+ (npm is recommended)
- **PostgreSQL** database
- Accounts / keys for:
  - [OpenRouter](https://openrouter.ai/) (AI reviews)
  - Google Cloud service account with Drive API access
  - SMTP provider (e.g. Gmail app password) for verification and notification emails

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
# App
NEXT_PUBLIC_APP_NAME="Advisor Review System"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Database (PostgreSQL)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"

# Auth (NextAuth / Auth.js)
# Generate with: npx auth secret
AUTH_SECRET="your-random-secret"

# AI (OpenRouter)
OPENROUTER_API_KEY="your-openrouter-api-key"
AI_MODEL="google/gemini-2.0-flash-001"

# Google Drive (service account)
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# SMTP (email verification & notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="\"Advisor System\" <your-email@gmail.com>"
```

Notes:

- Keep `\n` escapes in `GOOGLE_PRIVATE_KEY` when pasting a multiline key into `.env`.
- Share Drive folders with the service account email so the app can list and download files.

### 3. Set up the database

```bash
npx prisma migrate deploy
npx prisma generate
```

For local development you can also use:

```bash
npx prisma migrate dev
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). New users register at `/register`, verify email, then sign in at `/login`.

## Scripts

| Command           | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Start development server |
| `npm run build`   | Production build         |
| `npm run start`   | Start production server  |
| `npm run lint`    | Run ESLint               |

## Stack

- **Next.js 16** + React 19
- **PostgreSQL** + Prisma 7
- **Auth.js** (credentials + email verification)
- **Google Drive API** for document sync
- **OpenRouter** (Vercel AI SDK) for document review
- **Nodemailer** for outbound email
