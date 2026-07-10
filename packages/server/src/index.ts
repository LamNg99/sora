import { Hono } from 'hono';
import { sentry } from '@sentry/hono/bun';
import * as Sentry from '@sentry/hono/bun';
import { HTTPException } from 'hono/http-exception';
import sessions from './routes/sessions';
import chat from './routes/chat';

const app = new Hono();

app.use(
  sentry(app, {
    dsn: 'https://9765410c6a56760bf1e6427366e7582e@o4511707854012416.ingest.us.sentry.io/4511707858796544',
    tracesSampleRate: 1.0,
    enableLogs: true,
    dataCollection: {
      // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
      // https://docs.sentry.io/platforms/javascript/guides/hono/configuration/options/#dataCollection
      // userInfo: false,
      // httpBodies: [],
    },
  }),
);

app.get('/debug-sentry', () => {
  // Send a log before throwing the error
  Sentry.logger.info('User triggered test error', {
    action: 'test_error_endpoint',
  });
  // Send a test metric before throwing the error
  Sentry.metrics.count('test_counter', 1);
  throw new Error('My first Sentry error!');
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    Sentry.logger.warn('Handled HTTP error', {
      status: err.status,
      message: err.message || 'Request failed with an HTTP error',
      path: c.req.path,
      method: c.req.method,
    });
    return c.json({ message: err.message }, err.status);
  }

  Sentry.logger.error('Unhandled server error', {
    path: c.req.path,
    method: c.req.method,
    error: err instanceof Error ? err.message : 'Unknown error',
  });

  return c.json({ message: 'Internal Server Error' }, 500);
});

const routes = app.route('/sessions', sessions).route('/chat', chat);

export type AppType = typeof routes;

export default { port: 3000, fetch: app.fetch, idleTimeout: 255 };
