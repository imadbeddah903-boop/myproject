import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();

// نقطة الفحص باش Railway يعرف باللي السيرفور خدام
app.get('/health', (c) => {
  return c.text('OK', 200);
});

app.get('/', (c) => {
  return c.text('InkSpire Render Worker is running!', 200);
});

const port = Number(process.env.PORT || 8080);

serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0',
});

console.log(`Render Worker listening on 0.0.0.0:${port}`);
