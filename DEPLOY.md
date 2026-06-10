# Deployment Notes

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Random string for session signing |
| `ENCRYPTION_KEY` | AES-256 key for encrypting AI API keys |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Object storage bucket (Replit managed) |

## ⚠️ ENCRYPTION_KEY — Critical Warning

The `ENCRYPTION_KEY` is used to AES-256 encrypt AI provider API keys stored in the database.

**Never change this key after it has been set in production.**

If the key is lost or changed:
- All stored AI API keys in the database become unrecoverable
- Admins will need to re-enter their API keys on every tenant

### Generating the key (first time only)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and store it as the `ENCRYPTION_KEY` environment secret.

**Back up this key in a secure location (e.g., password manager or secrets vault).**

## Running Migrations

```bash
npm run db:push
```

## Building for Production

```bash
npm run build
```
