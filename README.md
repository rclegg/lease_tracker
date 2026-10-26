# lease_tracker

Track car-lease mileage: enter your lease terms and current odometer and see how many miles per day you can drive for the rest of the lease.

- `web/` is a static single-page app (`index.html`, `styles.css`, `app.js`, no build step). It runs in the browser and stores your last inputs in local storage only.
- The hosting stack (private S3 bucket behind CloudFront) lives in [rclegg/infra](https://github.com/rclegg/infra). This repo's workflow syncs `web/` to it.
- `.github/workflows/deploy.yml` deploys on every push to `main` using GitHub OIDC (no stored AWS keys).
- `legacy/LeaseTracker.py` is the original command-line script, kept for reference. It now measures days remaining from today to the lease end (it used to divide by the whole lease length, which was a bug); the web page does the same.
