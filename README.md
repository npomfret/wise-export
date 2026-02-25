# wise-export

An unofficial tool to bulk-export PDF statements and transaction history from [Wise](https://wise.com) (formerly TransferWise) personal accounts.

## Background

Wise has increasingly restricted API access for retail/personal customers. While business accounts retain full API access, personal account holders face significant limitations:

- **Personal API tokens** can be generated from your Wise settings page, but in the UK/EEA they are subject to [PSD2 Strong Customer Authentication (SCA)](https://docs.wise.com/guides/developer/auth-and-security/sca-and-2fa) requirements, which block balance statement retrieval without completing a cryptographic challenge flow.
- **The official [Balance Statement API](https://docs.wise.com/api-reference/balance-statement)** supports multiple formats — but only for authenticated sessions that satisfy SCA. For personal users, this means generating an RSA keypair, uploading the public key to Wise, and signing one-time tokens on every request ([example implementations](https://github.com/transferwise/digital-signatures-examples/blob/main/sca-personal-tokens/README.md)).
- **No OAuth access** is available for personal accounts — OAuth is reserved for Wise Platform partners.

This project works by interacting with the same internal web API that the Wise web app uses. This is inherently fragile — Wise can change their internal API at any time without notice.

## Prerequisites

- Node.js (v18+)
- A Wise personal account

## Setup

```bash
npm install
cp config.example.json config.json
```

## Configuration

Edit `config.json` with your details:

```json
{
  "startDate": "2024-01",
  "profileId": "1234567",
  "cookies": "...",
  "currencies": ["EUR", "GBP", "USD", "CAD"],
  "statementsDir": "~/Documents/path/to/statements"
}
```

| Field | Description |
|---|---|
| `startDate` | First month to export (YYYY-MM). Statements are generated month-by-month from this date; activities are fetched for the full range in one go. |
| `profileId` | Your Wise profile ID (see below). |
| `cookies` | Your browser session cookies (see below). |
| `currencies` | List of currency codes to export statements for. Balance IDs are fetched automatically. |
| `statementsDir` | Directory where PDF statements are saved, organized into currency subdirectories. Supports `~` for home directory. |
| `delayMs` | Optional delay between API requests in milliseconds (default: 1000) — to prevent rate limiting. |

### Getting your profile ID and cookies

1. Log in to [wise.com](https://wise.com) in your browser
2. Open Developer Tools (F12 or Cmd+Option+I)
3. Go to the **Network** tab
4. Navigate to **Balances > Statements** and generate a statement for any period
5. Find the `create?action=request` POST request in the network log
6. Right-click the request and choose **Copy as cURL**
7. From the copied curl command:
   - Extract the `Cookie:` header value and paste it into `config.json`
   - Extract your profile ID from the URL: `https://wise.com/hold/v1/profiles/YOUR_PROFILE_ID/statements-and-reports/...`

## Usage

### Sync everything

```bash
npm run sync
```

Runs statement sync followed by activities sync.

### Sync PDF statements only

```bash
npm run sync:statements
```

Runs two concurrent tasks:

1. **Creator** — iterates through each currency/month combination, posts a statement creation request, and queues the request ID for download
2. **Downloader** — polls the queue, downloading generated PDFs as they become ready, retrying if a statement isn't available yet

PDF statements are saved into currency subdirectories:

```
<statementsDir>/
  EUR/
    2024-01-01.EUR.statement.pdf
    2024-02-01.EUR.statement.pdf
  GBP/
    2024-01-01.GBP.statement.pdf
    ...
```

Progress is persisted to `tmp/pending.json`, and already-downloaded statements are skipped, so you can safely re-run to resume after failures or session expiry.

### Sync transaction history (activities)

```bash
npm run sync:activities
```

Fetches your full transaction history from `startDate` to now in a single pass (paginating in batches of 500), then converts it to CSV.

Output (both in `tmp/`):

- `activities-raw.json` — raw API response
- `activities.csv` — cleaned CSV with columns: `date`, `type`, `direction`, `title`, `description`, `amount`, `currency`, `secondaryAmount`, `secondaryCurrency`, `category`, `status`, `id`

The `direction` column is `credit` for incoming funds and `debit` for outgoing.

## Resumability

Statement sync is resumable — already-downloaded PDFs are skipped on re-run, and pending requests are persisted to `tmp/pending.json`.

Activities sync re-fetches the full history each run (it's a single fast API call).

**Important:** Your Wise session cookie will expire if the website logs you out. Keep your browser open on the Wise site and periodically refresh the page while the script is running to keep the session alive. If the session expires, grab a fresh cookie, update `config.json`, and re-run.

## Project structure

```
src/
  shared.ts                       — Config, auth headers, shared utilities
  sync-monthly-pdf-statements.ts  — PDF statement sync
  activities.ts                   — Transaction history fetch
  activities-to-csv.ts            — Raw JSON to CSV conversion
```

## Disclaimer

This tool is provided as-is for personal use only. It interacts with undocumented internal APIs and may break at any time. Use it at your own risk. This project is not affiliated with, endorsed by, or associated with Wise or TransferWise.
