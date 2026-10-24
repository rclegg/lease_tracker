# lease_tracker

Track car-lease mileage: enter your lease terms and current odometer and see how many miles per day you can drive for the rest of the lease.

- `web/index.html` is a single-page static app. It runs in the browser and stores your last inputs in local storage only.
- `infra/site.yaml` is the CloudFormation stack (private S3 bucket behind CloudFront), from [aws-static-site-template](https://github.com/rclegg/aws-static-site-template).
- `.github/workflows/deploy.yml` deploys on every push to `main` using GitHub OIDC (no stored AWS keys).
- `legacy_LeaseTracker.py` is the original command-line script, kept for reference. It measured days remaining from the lease start date rather than from today; the web page fixes that.
