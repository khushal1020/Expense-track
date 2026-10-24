# ExpenseTrack

A full-stack personal expense tracker built with React, Vite, Express, MongoDB, and Mongoose.

## Requirements
- Node.js 20.19+ or 22.12+
- npm
- MongoDB Community Server running locally
- MongoDB Compass (optional GUI for viewing and managing the local database)

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

### 2. Start MongoDB and configure the backend
Install MongoDB Community Server on Windows and run it as the `MongoDB` Windows service. Compass is a GUI client; it does not run the database server by itself. In PowerShell, check the service with `Get-Service MongoDB`; start it with `Start-Service MongoDB` if needed (an administrator PowerShell window may be required).

The backend uses `mongodb://127.0.0.1:27017/expensetrack`. If `server/.env` already exists, keep it and change only `MONGODB_URI` to that value; retain your existing `JWT_SECRET`. If it does not exist, copy `server/.env.example` to `server/.env` and replace the example `JWT_SECRET` with a unique random value (for example, `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). Keep `.env` out of version control and never put server secrets in `VITE_` variables. Set `NODE_ENV=production` and an HTTPS `CLIENT_URL` in production.

In Compass, connect with `mongodb://127.0.0.1:27017`. The `expensetrack` database and collections appear after the app first writes data. The API starts listening only after MongoDB connects. `/api/health` reports HTTP 200 when MongoDB is connected and HTTP 503 otherwise.

### 3. Configure the frontend
The frontend defaults to `http://localhost:5000/api`, so `client/.env` is optional for local development. If you create one, use the example value in `client/.env.example`; do not put database credentials or server secrets in it.

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

## Optional Atlas data migration
Changing the connection URI does not copy data from Atlas. This repository does not contain a seed or migration script, and the old Atlas URI was only in the example environment file. To preserve an Atlas database, install the official [MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/installation/) and create a backup before restoring. Do not use `--drop` when you need to preserve the target database.

From PowerShell, replace `<ATLAS_URI>` with the Atlas connection string without putting it in source control, then export the `expensetrack` database:

```powershell
mongodump --uri="<ATLAS_URI>" --db=expensetrack --out="$env:TEMP\traxer-atlas-backup"
```

Before importing, back up any existing local `expensetrack` data:

```powershell
mongodump --uri="mongodb://127.0.0.1:27017" --db=expensetrack --out="$env:TEMP\traxer-local-backup"
```

Restore the Atlas backup under a staging database name so you can inspect it in Compass without touching the app's local database:

```powershell
mongorestore --uri="mongodb://127.0.0.1:27017" --nsInclude="expensetrack.*" --nsFrom="expensetrack.*" --nsTo="expensetrack_atlas_import.*" "$env:TEMP\traxer-atlas-backup\expensetrack"
```

If `expensetrack` is confirmed empty and you want the Atlas records to become the app's data, restore the backup there:

```powershell
mongorestore --uri="mongodb://127.0.0.1:27017" --nsInclude="expensetrack.*" "$env:TEMP\traxer-atlas-backup"
```

Do not use `--drop`. A restore without `--drop` does not delete existing collections, but documents with conflicting IDs can fail to restore, so reconcile collisions before importing into a database that already has records.

## API security and authentication
- Register with `POST /api/auth/register` using `{ "email": "...", "password": "at-least-12-characters" }`, then send the returned bearer token in `Authorization` for protected routes.
- `POST /api/auth/login` issues a one-hour token; `GET /api/auth/me` returns the current account.
- Expense endpoints require authentication and restrict reads, updates, and deletes to the owning account. Registration cannot assign roles. Admin routes use a role check; promote a trusted account directly in MongoDB after verifying its email.
- The API uses Helmet security headers, a single configured CORS origin, bounded JSON bodies, general and login/registration rate limits, validated expense inputs, bcrypt password hashes, and JWT issuer/audience/expiry checks. By default, forwarded client IP headers are not trusted. If the API is behind a reverse proxy, set `TRUSTED_PROXIES` in `server/.env` to the exact proxy IP addresses or CIDR ranges (comma-separated); do not use a hop count or trust arbitrary forwarded addresses. The API rejects malformed proxy values and non-origin `CLIENT_URL` values.
- MongoDB connection strings and JWT secrets belong only in the server environment. The local development URI does not require Atlas credentials. Rotate any credential that was previously committed or shared.

The frontend remains a starter screen; connect it to the authentication and expense endpoints as a separate implementation step.
