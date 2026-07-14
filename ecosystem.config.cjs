/**
 * PM2 Ecosystem Configuration — University Landing Platform
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs          # Start / restart
 *   pm2 reload ecosystem.config.cjs         # Zero-downtime reload
 *   pm2 logs uni-landing                    # Live log tail
 *   pm2 save && pm2 startup                 # Persist across reboots
 *
 * Blog Scheduler note:
 *   The blog post scheduler (server/blogScheduler.ts) must run in exactly ONE
 *   instance to avoid duplicate job execution.  PM2 automatically sets the
 *   NODE_APP_INSTANCE env variable (0, 1, 2, …) for each cluster worker.
 *   The scheduler checks  `process.env.NODE_APP_INSTANCE === '0'`  (or that
 *   the variable is undefined, i.e. fork mode) before starting the cron job,
 *   so only the primary worker schedules posts even in cluster mode.
 */
module.exports = {
  apps: [
    {
      name: 'uni-landing',

      // Built server bundle produced by `npm run build`
      script: 'dist/index.cjs',

      // Load environment variables from .env file in the project root.
      // Requires Node.js 20.6+.  If your Node version is older, export the
      // variables manually in your shell or use a .env loader wrapper instead.
      node_args: '--env-file=.env',

      // Fork mode: single process — keeps in-memory caches (bootstrap, image,
      // ZIP export jobs) consistent across all requests.
      exec_mode: 'fork',
      instances: 1,

      // Restart automatically on crash
      autorestart: true,
      watch: false,

      // Restart worker if memory exceeds 512 MB
      max_memory_restart: '512M',

      // Merge all worker logs into a single stream
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      env: {
        NODE_ENV: 'production',
        PORT: 5000,

        // ── Required secrets — set these in your VPS .env or pass them here ──
        // DATABASE_URL: 'postgresql://user:pass@localhost:5432/uni_landing',
        // SESSION_SECRET: '<random-64-char-string>',
        // ENCRYPTION_KEY: '<random-64-char-hex>',

        // ── Upload storage ───────────────────────────────────────────────────
        // Absolute path to a persistent directory on the VPS.
        // Must survive deployments (i.e. NOT inside the repo working tree).
        // Example: /var/data/uni-landing/uploads
        // UPLOADS_DIR: '/var/data/uni-landing/uploads',
      },
    },
  ],
};
