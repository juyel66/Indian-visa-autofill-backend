# Visa Autofill Backend

Initial backend foundation for the Visa Autofill system.

## Tech Stack
- **Node.js** (TypeScript)
- **Express.js**
- **PostgreSQL / Neon PostgreSQL**
- **Prisma ORM**
- **Security & Utilities**: `helmet`, `cors`, `compression`, `dotenv`

## Project Structure
```text
visa-autofill-backend/
│
├── src/
│   ├── app.ts
│   └── server.ts
│
├── prisma/
│   └── schema.prisma
│
├── .env
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://username:password@host/database?sslmode=require"
PORT=8000
NODE_ENV=development
```

> **Security Note:** Never commit `.env` to Git. `.gitignore` is pre-configured to ignore all `.env` files.

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Generate Prisma Client
```bash
npx prisma generate
```

### 3. Run in Development Mode
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

### 5. Run Production Server
```bash
npm start
```

## API Endpoints

### Health Check
- **Endpoint**: `GET /health`
- **Response**:
```json
{
  "success": true,
  "message": "Visa Autofill server is healthy"
}
```
