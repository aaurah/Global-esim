# Global eSIM Privacy Pro

An original privacy-first eSIM commerce foundation. The current catalog and checkout are **sandbox-only**: seeded plan examples are not carrier availability, sandbox orders are not payments, and they never create usable eSIM profiles, phone numbers, or network access.

## Current foundation

- Public destination catalog and coverage summary.
- Guest sandbox checkout with a one-time private order access key (only its hash is stored).
- Clerk sign-in and administrator-role checks.
- Admin overview, plan CRUD, recent orders, and integration readiness.
- PostgreSQL-backed plans and orders.
- Provider readiness checks that never claim unverified connections are live.

## First administrator

After the trusted operator has created and verified their account, run the one-time grant command using a secure environment value:

```sh
ADMIN_EMAIL=operator@example.com pnpm --filter @workspace/api-server run grant-admin
```

The command merges `role: "admin"` into that exact Clerk account's public metadata. Do not grant this role to an unverified or untrusted account. The server checks the role with Clerk before every admin operation.

## Live integrations

The application does not accept live payments or provision carrier service yet. Before enabling those paths, select a contracted eSIM supplier and configure its documented adapter, callbacks, and country-specific requirements. Provider secrets belong in Replit Secrets, not the database or browser bundle.

The readiness panel checks only whether required configuration names are present; it does not establish a healthy or approved integration. The initial supported configuration names are:

- BTCPay Server: `BTCPAY_SERVER_URL`, `BTCPAY_API_KEY`
- Telecom supplier: `ESIM_SUPPLIER_URL`, `ESIM_SUPPLIER_API_KEY`

Even when these are present, the status remains unverified until a successful provider-specific health, payment, webhook, and provisioning validation is implemented and completed.

## Data safety

- No private wallet keys or provider tokens are written into application tables.
- Guest order lookup keys are high-entropy, shown once, and stored as SHA-256 hashes.
- Sandbox data remains explicitly identified as sandbox in database rows and API responses.
- Database setup only creates/updates the declared schema; it does not reset tables or delete existing records.
