# wise-export

An unofficial tool to generate PDF statements from [Wise](https://wise.com) (formerly TransferWise) personal accounts.

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
  "balances": {
    "EUR": 12345,
    "GBP": 12346
  },
  "delayMs": 1000
}
```

| Field | Description |
|---|---|
| `startDate` | First month to export (YYYY-MM). Statements are generated from this month up to (but not including) the current month. |
| `profileId` | Your Wise profile ID (visible in the URL when logged in). |
| `cookies` | Your browser session cookies (see below). |
| `balances` | Mapping of currency code to Wise balance ID. |
| `delayMs` | Delay between API requests in milliseconds (default: 1000). |

### Getting your cookies

1. Log in to [wise.com](https://wise.com) in your browser
2. Open Developer Tools (F12 or Cmd+Option+I)
3. Go to the **Network** tab
4. Navigate to **Balances > Statements** and generate a statement for any period
5. Find the `create?action=request` POST request in the network log
6. Right-click the request and choose **Copy as cURL**
7. Extract the `Cookie:` header value from the copied curl command and paste it into `config.json`

The cookies will expire when your Wise session ends — you'll need to repeat this process when that happens.

### Getting your balance IDs

From the same copied curl command, look at the request body — the `balances` array contains your balance IDs. To figure out which ID maps to which currency, check the currency dropdown on the Wise statements page — the order matches the array order.

### Getting your profile ID

Your profile ID appears in the URL of the curl command:
```
https://wise.com/hold/v1/profiles/YOUR_PROFILE_ID/statements-and-reports/...
```

## Usage

```bash
npm run sync
```

The script runs in two phases:

1. **Create** — requests a statement for each currency/month combination and saves the request IDs to `tmp/pending.json`
2. **Download** — downloads each generated PDF to `statements/`

Already-downloaded statements are skipped, so you can safely re-run `npm run sync` to resume after failures or session expiry.

**Important:** Your Wise session cookie will expire if the website logs you out. Keep your browser open on the Wise site and periodically refresh the page while the script is running to keep the session alive. If the session does expire, grab a fresh cookie value, update `config.json`, and re-run — already-downloaded statements will be skipped.

## Disclaimer

This tool is provided as-is for personal use only. It interacts with undocumented internal APIs and may break at any time. Use it at your own risk. This project is not affiliated with, endorsed by, or associated with Wise or TransferWise.
