# Visa Autofill

Comprehensive Visa Application Assistant monorepo featuring an Express.js & PostgreSQL backend and a modern Next.js TypeScript dashboard.

## Project Structure

```text
visa-autofill-backend/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── lib/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── applications/
│   │   │   │   └── [id]/
│   │   │   ├── profile/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── login/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   ├── .env.local.example
│   ├── next.config.mjs
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── package.json
├── .gitignore
└── README.md
```

---

## Environment Setup

### 1. Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and configure:

```env
PORT=8000
NODE_ENV=development

DATABASE_URL="postgresql://username:password@host-pooler/database?sslmode=require"
DIRECT_URL="postgresql://username:password@host/database?sslmode=require"

GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="https://idjemajdjnoefigfbnnfmcpnnfgme.chromiumapp.org/"

JWT_SECRET="your-jwt-secret"
JWT_ACCESS_SECRET="your-jwt-access-secret"
JWT_REFRESH_SECRET="your-jwt-refresh-secret"

JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

CLIENT_ORIGIN="http://localhost:3000"
```

### 2. Frontend (`frontend/.env.local`)

Copy `frontend/.env.local.example` to `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

---

## Development

### Running the Entire Monorepo (Root)

From the project root directory, install root dependencies and run both servers simultaneously using `concurrently`:

```bash
npm install
npm run dev
```

This starts:
- **Backend**: [http://localhost:8000](http://localhost:8000)
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)

### Standalone Backend

```bash
cd backend
npm install
npm run dev
```

Backend scripts:
- `npm run dev`: Starts development server with `tsx watch` on port `8000`
- `npm run build`: Compiles TypeScript with `tsc`
- `npm run start`: Runs compiled server `dist/server.js`
- `npm run prisma:generate`: Generates Prisma client
- `npm run prisma:migrate`: Runs database migrations

### Standalone Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend scripts:
- `npm run dev`: Starts Next.js development server on port `3000`
- `npm run build`: Builds production bundle
- `npm run start`: Starts production Next.js server on port `3000`

---

## Building for Production

From project root:

```bash
npm run build
```

This builds both the backend (`tsc`) and the frontend (`next build`).

---

## Dashboard Features

- **Google OAuth Authentication**: Reuses the exact same backend Google authentication tokens, User model, and database as the Chrome Extension.
- **Overview Dashboard (`/dashboard`)**: Displays real dynamic statistics (total applications, recently updated within 7 days, saved original documents).
- **New Application Quick Action**: Clear guidance on how OCR extraction in the Chrome Extension feeds saved applications directly into the dashboard.
- **Application Management (`/dashboard/applications`)**:
  - Responsive table (desktop) and card layout (mobile).
  - Client-side search and filtering by applicant name and passport number.
  - Direct download of original passport PDF (`GET /api/applications/:id/pdf`).
  - Safe application deletion with confirmation modal (`DELETE /api/applications/:id`).
- **Application Detail & Full Edit (`/dashboard/applications/[id]`)**:
  - Organized into 10 canonical sections: *Registration, Basic Details, Family Details, Present Address, Permanent Address, Passport, Employment, Visa & References, Additional Questions, Metadata*.
  - Full-object preservation: maintains 100% of unknown fields, OCR confidence, provenance, photograph, and manual edits on `PUT /api/applications/:id`.
- **User Profile (`/dashboard/profile`)**: Displays Google name, email, avatar, and account statistics without exposing sensitive secrets or raw tokens.
- **Lightweight Toast Notifications**: Accessible feedback for saves, updates, deletions, and PDF downloads.
