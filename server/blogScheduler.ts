import cron from 'node-cron';
import { db } from './db';
import { blogPosts, blogSchedule } from '@shared/schema';
import { eq, and, lte, sql } from 'drizzle-orm';

let schedulerStarted = false;

/**
 * PM2 cluster guard: only start scheduler on instance 0 (or in non-PM2 mode).
 * Additionally acquires a PostgreSQL advisory lock each tick to prevent
 * duplicate execution if multiple processes happen to run the cron.
 */
function isMasterInstance(): boolean {
  const instance = process.env.NODE_APP_INSTANCE;
  return instance === undefined || instance === '0';
}

async function tryAdvisoryLock(lockId: number): Promise<boolean> {
  try {
    const result = await db.execute(sql`SELECT pg_try_advisory_lock(${lockId}) AS locked`);
    const row = result.rows?.[0] as { locked: boolean } | undefined;
    return row?.locked === true;
  } catch {
    return false;
  }
}

async function releaseAdvisoryLock(lockId: number): Promise<void> {
  try {
    await db.execute(sql`SELECT pg_advisory_unlock(${lockId})`);
  } catch { /* ignore */ }
}

const BLOG_SCHEDULER_LOCK_ID = 7777001;

async function runSchedulerTick() {
  const locked = await tryAdvisoryLock(BLOG_SCHEDULER_LOCK_ID);
  if (!locked) {
    console.log('[BlogScheduler] Another instance holds the lock — skipping tick');
    return;
  }

  try {
    const now = new Date();
    const dayOfWeek = String(now.getDay()); // 0=Sun, 1=Mon, ...

    // Get all enabled schedules
    const schedules = await db.select().from(blogSchedule).where(eq(blogSchedule.isEnabled, true));

    for (const schedule of schedules) {
      if (!schedule.weekdays || !Array.isArray(schedule.weekdays)) continue;
      if (!schedule.weekdays.includes(dayOfWeek)) continue;

      const dailyLimit = schedule.dailyLimit ?? 1;
      const tenantId = schedule.tenantId;

      if (schedule.mode === 'otomatik') {
        // Auto mode: publish posts where publishAt <= now, status=zamanli
        // Respect daily limit
        const candidates = await db.select()
          .from(blogPosts)
          .where(and(
            eq(blogPosts.tenantId, tenantId),
            eq(blogPosts.status, 'zamanli'),
            lte(blogPosts.publishAt, now),
          ))
          .limit(dailyLimit);

        for (const post of candidates) {
          await db.update(blogPosts)
            .set({ status: 'yayinda' })
            .where(eq(blogPosts.id, post.id));
          console.log(`[BlogScheduler] Auto-published post ${post.id} for tenant ${tenantId}`);
        }
      }
      // 'onay' mode: admin must approve — nothing to auto-publish
    }
  } finally {
    await releaseAdvisoryLock(BLOG_SCHEDULER_LOCK_ID);
  }
}

export function startBlogScheduler() {
  if (schedulerStarted) return;
  if (!isMasterInstance()) {
    console.log('[BlogScheduler] Not master instance — scheduler disabled');
    return;
  }

  schedulerStarted = true;
  // Run daily at midnight
  cron.schedule('0 0 * * *', () => {
    runSchedulerTick().catch(err => console.error('[BlogScheduler] Tick error:', err));
  });
  console.log('[BlogScheduler] Started (daily midnight cron)');
}
