# ExpenseTrack

A full-stack personal expense tracker built with React, Vite, Express, MongoDB, and Mongoose.

## Requirements
- Node.js 20.19+ or 22.12+
- npm
- MongoDB Atlas account and a database connection string

## Project structure
- `client/`: React + Vite frontend
- `server/`: Express REST API

## Setup

### 1. Install dependencies
Open a terminal in the project root:

```bash
cd server
npm install
cd ../client
npm install
```

### 2. Configure the backend
Copy `server/.env.example` to `server/.env`, enter your MongoDB connection string, and replace `JWT_SECRET` with a unique random value (for example, `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). Keep this file out of version control and never put server secrets in `VITE_` variables. Set `NODE_ENV=production` and an HTTPS `CLIENT_URL` in production.

### 3. Configure the frontend
Copy `client/.env.example` to `client/.env`.

### 4. Run the app
In one terminal:

```bash
cd server
npm run dev
```

In a second terminal:

```bash
cd client
npm run dev
```

Frontend: http://localhost:5173

Backend health check: http://localhost:5000/api/health

Do not commit `.env` files. Never put server secrets in `VITE_` variables.

## API security and authentication
- Register with `POST /api/auth/register` using `{ "email": "...", "password": "at-least-12-characters" }`, then send the returned bearer token in `Authorization` for protected routes.
- `POST /api/auth/login` issues a one-hour token; `GET /api/auth/me` returns the current account.
- Expense endpoints require authentication and restrict reads, updates, and deletes to the owning account. Registration cannot assign roles. Admin routes use a role check; promote a trusted account directly in MongoDB after verifying its email.
- The API uses Helmet security headers, a single configured CORS origin, bounded JSON bodies, general and login/registration rate limits, validated expense inputs, bcrypt password hashes, and JWT issuer/audience/expiry checks.
- MongoDB credentials and JWT secrets belong only in the server environment. Use a least-privilege MongoDB database user, TLS, and network access restrictions in Atlas. Rotate any credential that was previously committed or shared.

The frontend remains a starter screen; connect it to the authentication and expense endpoints as a separate implementation step.
