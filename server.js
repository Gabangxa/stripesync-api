'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory stores
const workspaces = new Map();
const events = [];

// ─── Seed sample events on startup ───────────────────────────────────────────
const SEED_WORKSPACE_IDS = ['ws_demo_alpha', 'ws_demo_beta'];

const seedEvents = [
  {
    event_id: 'evt_001',
    workspace_id: 'ws_demo_alpha',
    stripe_event_type: 'payment_intent.succeeded',
    stripe_event_id: 'pi_3Oa1bcStripe001',
    accounting_action: 'create_invoice_and_payment',
    accounting_platform: 'quickbooks',
    status: 'success',
    amount_cents: 4900,
    currency: 'usd',
    created_at: '2026-03-25T08:12:00Z',
    processed_at: '2026-03-25T08:12:01Z',
  },
  {
    event_id: 'evt_002',
    workspace_id: 'ws_demo_alpha',
    stripe_event_type: 'customer.subscription.created',
    stripe_event_id: 'sub_3Oa2bcStripe002',
    accounting_action: 'create_recurring_invoice',
    accounting_platform: 'quickbooks',
    status: 'success',
    amount_cents: 2900,
    currency: 'usd',
    created_at: '2026-03-25T09:00:00Z',
    processed_at: '2026-03-25T09:00:01Z',
  },
  {
    event_id: 'evt_003',
    workspace_id: 'ws_demo_beta',
    stripe_event_type: 'charge.refunded',
    stripe_event_id: 'ch_3Oa3bcStripe003',
    accounting_action: 'create_credit_note',
    accounting_platform: 'xero',
    status: 'success',
    amount_cents: 1500,
    currency: 'usd',
    created_at: '2026-03-25T10:30:00Z',
    processed_at: '2026-03-25T10:30:02Z',
  },
  {
    event_id: 'evt_004',
    workspace_id: 'ws_demo_alpha',
    stripe_event_type: 'payment_intent.succeeded',
    stripe_event_id: 'pi_3Oa4bcStripe004',
    accounting_action: 'create_invoice_and_payment',
    accounting_platform: 'quickbooks',
    status: 'failed',
    amount_cents: 9900,
    currency: 'usd',
    created_at: '2026-03-25T11:45:00Z',
    processed_at: '2026-03-25T11:45:03Z',
  },
  {
    event_id: 'evt_005',
    workspace_id: 'ws_demo_beta',
    stripe_event_type: 'customer.subscription.deleted',
    stripe_event_id: 'sub_3Oa5bcStripe005',
    accounting_action: 'log_cancellation',
    accounting_platform: 'xero',
    status: 'success',
    amount_cents: 0,
    currency: 'usd',
    created_at: '2026-03-26T07:00:00Z',
    processed_at: '2026-03-26T07:00:01Z',
  },
  {
    event_id: 'evt_006',
    workspace_id: 'ws_demo_beta',
    stripe_event_type: 'payment_intent.succeeded',
    stripe_event_id: 'pi_3Oa6bcStripe006',
    accounting_action: 'create_invoice_and_payment',
    accounting_platform: 'xero',
    status: 'success',
    amount_cents: 7900,
    currency: 'usd',
    created_at: '2026-03-26T08:15:00Z',
    processed_at: '2026-03-26T08:15:01Z',
  },
  {
    event_id: 'evt_007',
    workspace_id: 'ws_demo_alpha',
    stripe_event_type: 'charge.refunded',
    stripe_event_id: 'ch_3Oa7bcStripe007',
    accounting_action: 'create_credit_note',
    accounting_platform: 'quickbooks',
    status: 'failed',
    amount_cents: 4900,
    currency: 'usd',
    created_at: '2026-03-26T09:00:00Z',
    processed_at: '2026-03-26T09:00:02Z',
  },
  {
    event_id: 'evt_008',
    workspace_id: 'ws_demo_alpha',
    stripe_event_type: 'customer.subscription.created',
    stripe_event_id: 'sub_3Oa8bcStripe008',
    accounting_action: 'create_recurring_invoice',
    accounting_platform: 'quickbooks',
    status: 'success',
    amount_cents: 2900,
    currency: 'usd',
    created_at: '2026-03-26T10:00:00Z',
    processed_at: '2026-03-26T10:00:01Z',
  },
];
events.push(...seedEvents);

// Seed demo workspaces so the demo webhook URLs are valid
workspaces.set('ws_demo_alpha', {
  workspace_id: 'ws_demo_alpha',
  name: 'Demo Alpha (QuickBooks)',
  stripe_webhook_secret: 'whsec_demo_alpha',
  accounting_platform: 'quickbooks',
  accounting_token: 'Bearer demo_token_alpha',
  status: 'active',
  created_at: '2026-03-25T08:00:00Z',
});
workspaces.set('ws_demo_beta', {
  workspace_id: 'ws_demo_beta',
  name: 'Demo Beta (Xero)',
  stripe_webhook_secret: 'whsec_demo_beta',
  accounting_platform: 'xero',
  accounting_token: 'Bearer demo_token_beta',
  status: 'active',
  created_at: '2026-03-25T09:00:00Z',
});

// ─── Helper: resolve accounting action from Stripe event type ─────────────────
function resolveAccountingAction(eventType) {
  switch (eventType) {
    case 'payment_intent.succeeded':
      return 'create_invoice_and_payment';
    case 'charge.refunded':
      return 'create_credit_note';
    case 'customer.subscription.created':
      return 'create_recurring_invoice';
    case 'customer.subscription.deleted':
      return 'log_cancellation';
    default:
      return 'unhandled';
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// GET /docs — served from public/docs.html via static middleware
// (express.static handles /docs.html; map /docs to docs.html explicitly)
app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

// GET / — served from public/index.html via static middleware
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// POST /v1/workspaces
app.post('/v1/workspaces', (req, res) => {
  const { stripe_webhook_secret, accounting_platform, accounting_token, name } = req.body;

  if (!stripe_webhook_secret || !accounting_platform || !accounting_token || !name) {
    return res.status(400).json({
      error: 'bad_request',
      message: 'Missing required fields: stripe_webhook_secret, accounting_platform, accounting_token, name',
    });
  }

  if (!['quickbooks', 'xero'].includes(accounting_platform)) {
    return res.status(400).json({
      error: 'bad_request',
      message: 'accounting_platform must be "quickbooks" or "xero"',
    });
  }

  const workspace_id = 'ws_' + uuidv4().replace(/-/g, '').slice(0, 12);
  const created_at = new Date().toISOString();

  const workspace = {
    workspace_id,
    name,
    stripe_webhook_secret,
    accounting_platform,
    accounting_token,
    status: 'active',
    created_at,
  };
  workspaces.set(workspace_id, workspace);

  const webhook_url = `${req.protocol}://${req.get('host')}/v1/stripe/events/${workspace_id}`;

  res.status(201).json({ workspace_id, webhook_url, status: 'active', created_at });
});

// GET /v1/workspaces/:id/webhook-url
app.get('/v1/workspaces/:id/webhook-url', (req, res) => {
  const workspace = workspaces.get(req.params.id);
  if (!workspace) {
    return res.status(404).json({ error: 'not_found', message: 'Workspace not found' });
  }
  const webhook_url = `${req.protocol}://${req.get('host')}/v1/stripe/events/${workspace.workspace_id}`;
  res.json({ workspace_id: workspace.workspace_id, webhook_url, status: workspace.status });
});

// POST /v1/stripe/events/:workspace_id  — Stripe webhook receiver
app.post('/v1/stripe/events/:workspace_id', (req, res) => {
  const workspace = workspaces.get(req.params.workspace_id);
  if (!workspace) {
    return res.status(404).json({ error: 'not_found', message: 'Workspace not found' });
  }

  // Signature validation is simulated — log the attempt
  const sigHeader = req.headers['stripe-signature'];
  console.log(`[webhook] workspace=${workspace.workspace_id} sig_present=${!!sigHeader}`);

  const body = req.body;
  const stripeEventType = body.type || 'unknown';
  const stripeEventId = body.id || 'evt_' + uuidv4().slice(0, 8);
  const amountCents = body.data && body.data.object && body.data.object.amount
    ? body.data.object.amount
    : 0;
  const currency = body.data && body.data.object && body.data.object.currency
    ? body.data.object.currency
    : 'usd';

  const accountingAction = resolveAccountingAction(stripeEventType);
  const now = new Date().toISOString();

  const event = {
    event_id: 'evt_' + uuidv4().replace(/-/g, '').slice(0, 12),
    workspace_id: workspace.workspace_id,
    stripe_event_type: stripeEventType,
    stripe_event_id: stripeEventId,
    accounting_action: accountingAction,
    accounting_platform: workspace.accounting_platform,
    status: accountingAction === 'unhandled' ? 'pending' : 'success',
    amount_cents: amountCents,
    currency,
    created_at: now,
    processed_at: now,
  };
  events.unshift(event);

  res.json({ received: true, event_id: event.event_id, accounting_action: accountingAction });
});

// GET /v1/events
app.get('/v1/events', (req, res) => {
  const { workspace_id, status, limit = '20', offset = '0' } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const off = parseInt(offset, 10) || 0;

  let filtered = events;
  if (workspace_id) filtered = filtered.filter(e => e.workspace_id === workspace_id);
  if (status) filtered = filtered.filter(e => e.status === status);

  const total = filtered.length;
  const page = filtered.slice(off, off + lim);

  res.json({ events: page, total, limit: lim, offset: off });
});

// POST /v1/events/:event_id/retry
app.post('/v1/events/:event_id/retry', (req, res) => {
  const idx = events.findIndex(e => e.event_id === req.params.event_id);
  if (idx === -1) {
    return res.status(404).json({ error: 'not_found', message: 'Event not found' });
  }
  if (events[idx].status !== 'failed') {
    return res.status(422).json({ error: 'unprocessable', message: 'Only failed events can be retried' });
  }
  events[idx].status = 'success';
  events[idx].processed_at = new Date().toISOString();
  res.json(events[idx]);
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`StripeSync API running on http://0.0.0.0:${PORT}`);
});
