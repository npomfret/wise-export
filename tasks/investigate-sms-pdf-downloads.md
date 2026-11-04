# Investigate SMS-based PDF download automation

## Goal

Determine whether Wise's SMS verification option can support unattended PDF statement downloads on this Mac, using codes received through iPhone-to-Mac Messages forwarding.

This is an investigation and proof of concept. Keep the current CSV-only sync working while evaluating it.

## Current state (2026-11-04)

- `npm run sync` exports activities and CSV. The latest verified export contains 655 activities.
- PDF sync was removed because a valid login cookie did not satisfy Wise's additional download verification. The passkey flow was HTTP 403 → approval → HTTP 200, and its approval could not be reused.
- SMS has not been tested. Passkey behavior alone does not establish that SMS automation is infeasible.
- February–October 2026 were downloaded manually: nine monthly ZIP bundles, each containing separate EUR, GBP, CAD and USD PDFs. The local archive now has 142 monthly PDFs per currency, from January 2015 through October 2026.
- Four recurring monthly PDF schedules remain configured in Wise, with the next statements due on 1 December 2026. These do not download files to this Mac.

## Investigation

1. Capture Wise's **Try another way → Send code by SMS** flow, including the challenge, SMS trigger, code submission and authorized PDF download. Keep cookies, codes, approval tokens and raw HAR files out of Git.
2. Verify that the Wise SMS arrives in Messages on this Mac through the existing iPhone forwarding/iCloud setup. Establish how a local helper could reliably receive it. Apple does not provide a general macOS API for reading the SMS inbox; assess the available local approaches and their permissions rather than assuming the iMessage framework provides access.
3. Build a minimal flow: request the download → request its SMS code → match the newly received Wise message to the pending challenge → submit the code → download the statement bundle. Reject stale or ambiguous codes and avoid logging their contents.
4. Test consecutive downloads to establish whether each bundle requires a fresh code, whether approval has any reusable lifetime, and whether delivery delays or request limits make bulk downloads impractical. Verify this experimentally.
5. Record whether this can be unattended, needs occasional intervention, or remains manual. Reintroduce PDF sync only after a working proof of concept establishes the behavior.

## If viable

- Follow Wise's multi-step form using its `refreshUrl`, preserving the returned `model`, including `trackedCompletedSteps`. The balance picker appears after selecting the period; **Generate** is the final submission, not the form-refresh operation.
- Generate one monthly bundle for all four currencies, then file its four PDFs separately using the existing `<currency>/<YYYY-MM>-01.<currency>.statement.pdf` naming convention.
- Preserve differing existing files with SHA-256 versioning. Leave identical files untouched.
- Keep download progress resumable and let activity/CSV sync succeed independently of PDF authentication failures.

## References

- [Apple: forwarding text messages to other devices](https://support.apple.com/en-mt/102545)
- [Apple Developer Support: macOS SMS inbox API limitations](https://developer.apple.com/forums/thread/804040)
- [Wise: alternative verification methods](https://wise.com/help/articles/2951949/i-cant-use-my-step-verification-method)
- [Wise: Strong Customer Authentication](https://docs.wise.com/guides/developer/auth-and-security/sca-and-2fa)
