# StripeSync API

Developer-first Stripe → QuickBooks & Xero webhook bridge. Configure via API, not UI.

[![Run on Replit](https://replit.com/badge/github/Gabangxa/stripesync-api)](https://replit.com/new/github/Gabangxa/stripesync-api)

## What it does

POST your Stripe webhook secret and QuickBooks/Xero OAuth token once — get a webhook URL back. Paste that URL into Stripe Dashboard. Every `payment_intent.succeeded`, `charge.refunded`, and subscription event automatically creates the corresponding invoice, payment, or credit note.

## Quick Start

```bash
# 1. Create a workspace
curl -X POST https://your-app.replit.app/v1/workspaces \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My SaaS",
    "accounting_platform": "quickbooks",
    "stripe_webhook_secret": "whsec_live_...",
    "accounting_token": "Bearer ya29.live..."
  }'

# 2. Paste the returned webhook_url into Stripe Dashboard → Developers → Webhooks

# 3. Monitor your sync
curl https://your-app.replit.app/v1/events?workspace_id=ws_abc123
```

## Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/workspaces | Create workspace, get webhook URL |
| GET | /v1/workspaces/:id/webhook-url | Get webhook URL for workspace |
| POST | /v1/stripe/events/:workspace_id | Stripe webhook receiver (Stripe calls this) |
| GET | /v1/events | Paginated event log |
| POST | /v1/events/:id/retry | Retry a failed event |
| GET | /health | Health check |
| GET | /docs | API documentation |

## Run on Replit

1. Import this repo at [replit.com/new/github/Gabangxa/stripesync-api](https://replit.com/new/github/Gabangxa/stripesync-api)
2. Click **Run**
3. No config needed — starts on `process.env.PORT || 3000`

## Stack

- Node.js + Express
- In-memory storage (Map + Array) — no database required for mockup
- Plain HTML/CSS/JS frontend — no build step
