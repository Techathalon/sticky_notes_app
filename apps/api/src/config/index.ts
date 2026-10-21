// ─── Environment config ────────────────────────────────────────
// Validates and exports all required environment variables.

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  NODE_ENV: (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test',
  PORT: parseInt(process.env.PORT ?? '3000', 10),
  DATABASE_URL: requireEnv('DATABASE_URL'),
  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '1h',
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? 'http://localhost:8081').split(','),
  BREVO_API_KEY: process.env.BREVO_API_KEY ?? '',
  FROM_EMAIL: process.env.FROM_EMAIL ?? 'noreply@yourdomain.com',
  FROM_NAME: process.env.FROM_NAME ?? 'Sticky Notes',
  // Firebase Admin SDK — JSON string of the service account key
  // Get from Firebase Console → Project Settings → Service Accounts → Generate new private key
  FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT ?? '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
  APP_URL: process.env.APP_URL ?? 'http://localhost:3000',
  // MinIO (S3-compatible object storage for note images)
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT ?? 'http://localhost:9000',
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
  MINIO_BUCKET: process.env.MINIO_BUCKET ?? 'notes-images',
  MINIO_PUBLIC_URL: process.env.MINIO_PUBLIC_URL ?? 'http://localhost:9000',
} as const;
