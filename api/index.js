// Vercel serverless entry point: every /api/* request is routed here (see vercel.json).
import { createApp } from '../server/src/app.js';

const app = createApp();

export default app;
