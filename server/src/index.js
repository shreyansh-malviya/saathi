import cron from 'node-cron';
import { createApp } from './app.js';
import { connectDB } from './db.js';
import { config } from './config.js';
import { tickAll } from './services/days.js';
import { cleanupDemos } from './services/demo.js';

// Local / long-running entry point. In production on Vercel the same app runs
// as a serverless function (api/index.js) and the scheduler is external.

const app = createApp();

await connectDB();
app.listen(config.port, () => {
  console.log(`Saathi API listening on http://localhost:${config.port}`);
});

// Every minute: move escalation ladders forward. Safe to overlap with the
// external scheduler because every step is applied with a conditional update.
cron.schedule('* * * * *', async () => {
  try {
    const results = await tickAll();
    const moved = results.filter((r) => r.moved);
    if (moved.length) console.log(`[tick] moved ${moved.length} circle(s)`, moved.map((m) => `${m.toLevel}`));
    await cleanupDemos();
  } catch (err) {
    console.error('[tick] failed', err.message);
  }
});
