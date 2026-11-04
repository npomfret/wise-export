# wise-export

An unofficial tool to export transaction history from [Wise](https://wise.com) personal accounts to CSV.

It uses the same internal activities API as the Wise website. Wise can change this API without notice.

## Setup

Requires Node.js v18+ and a Wise personal account.

```bash
npm install
cp config.example.json config.json
```

Edit `config.json`:

```json
{
  "startDate": "2024-01",
  "profileId": "1234567",
  "cookies": "...",
  "outputDir": "~/Documents/wise-exports"
}
```

| Field | Description |
|---|---|
| `startDate` | First month to export, in YYYY-MM format. |
| `profileId` | Your Wise profile ID. |
| `cookies` | Your browser session's Cookie header value. |
| `outputDir` | Folder for `activities.csv`. Supports `~` for your home directory. Existing configurations using `statementsDir` still work. |
| `delayMs` | Optional delay between API requests in milliseconds (default: 1000). |

To get the profile ID and cookies:

1. Log in to [wise.com](https://wise.com) and open Developer Tools.
2. Open the **Network** tab and navigate to **Transactions**.
3. Find the request to `/gateway/v1/profiles/YOUR_PROFILE_ID/activities/list/`.
4. Copy the profile ID from its URL and the `Cookie` request header into `config.json`.

`config.json` and `tmp/` are ignored by Git. Keep session cookies private. When the session expires, log in again and update the cookie.

## Usage

```bash
npm run sync
```

Fetches all activities from `startDate` to now, paginating in batches of 500, then converts the result to CSV. This is also available as `npm run sync:activities`.

- `tmp/activities-raw.json` holds the raw API response.
- `<outputDir>/activities.csv` holds the CSV export.

CSV columns: `date`, `type`, `direction`, `title`, `description`, `amount`, `currency`, `secondaryAmount`, `secondaryCurrency`, `category`, `status`, `id`. Direction is `credit`, `debit` or `transfer` for currency conversions.

To reconvert an existing raw download without fetching again:

```bash
npm run activities:csv
```

Each sync fetches the full configured history again. PDF statement sync has been removed: Wise's current download flow requires additional approval for each PDF, preventing unattended exports with browser cookies. Existing local PDFs are left untouched. Recurring schedules configured on wise.com are managed separately and are not changed by this project.

## Development

```bash
npm run build
```

`src/shared.ts` handles configuration and authentication headers, `src/activities.ts` fetches history, and `src/activities-to-csv.ts` converts it to CSV.

## Disclaimer

This tool is provided as-is for personal use. It interacts with undocumented APIs and may break without notice. This project is not affiliated with, endorsed by, or associated with Wise or TransferWise.
