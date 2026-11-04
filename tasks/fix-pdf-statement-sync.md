# Fix PDF statement sync

## Resolution (2026-11-04)

The new multi-step form was captured and statement creation verified. Four separate monthly PDF schedules (EUR, GBP, CAD and USD) were created in Wise, starting November 2026, with the next statements due on 1 December 2026.

PDF downloads also require a separate Strong Customer Authentication approval. The captured flow was HTTP 403 → passkey approval → HTTP 200 PDF; the approval could not be reused, and an updated login cookie alone was insufficient. At the user's request, PDF sync was removed from this project rather than retaining a workflow requiring manual approval per download. `npm run sync` now fetches activities and converts them to CSV. Existing local PDFs and Wise schedules are preserved.

Activity fetching was reverified with the refreshed cookie: 655 activities. The details below describe the original issue.

## Problem

`npm run sync` dies in `src/sync-monthly-pdf-statements.ts` at `fetchBalanceIds()`:

```
TypeError: Cannot read properties of undefined (reading 'properties')
  const options: any[] = balancesSchema.properties.balances.items.oneOf;
```

As of Nov 2026, `GET /hold/v1/profiles/{profileId}/statements-and-reports/balance-statement/create`
returns a multi-step form ("1 of 4"). Step 1 has only these schemas:

- `#dateRangeInput`
- `#fromInput`
- `#toInput`
- `#schedulePeriodInput`
- `#stepTrackingState`

`#balancesInput` is gone from step 1. The balance picker presumably appears in a later step, which
is reached via the "Generate" button action (`layout[3].right[1].behavior.action`).

## To do

1. Capture the new flow in the browser. Generate a statement manually on wise.com with DevTools
   open, and save the HAR. Remove the cookies before committing it, or don't commit it.
2. Rework `fetchBalanceIds()` and `createStatement()` to walk the steps. Post each step's `model`
   (including `trackedCompletedSteps`) to the step's action URL, then read `#balancesInput` from
   the step that has it.
3. Fail with a clear message if the expected schema isn't found, rather than a TypeError.
4. Make `npm run sync` run activities even when the PDF step fails. Today the `&&` chain means
   activities only run if the PDF sync succeeds.

## Still works

`npm run sync:activities` (activities → `activities.csv`) is unaffected. It last ran on
2026-11-04 and exported 655 activities, from 2016-08 to 2026-11.
