# Admin app instructions

- `docs/architecture.md` is the single source of truth for image identity, publication, and serving.
- Keep `apps/admin` home-server-only. Do not add a Vercel project or serverless storage workaround.
- Never commit tokens, token digests, host paths, CIDRs, IP addresses, certificates, backup credentials, or deployed compose values.
- Keep the admin writer private and the media origin read-only; neither service publishes a host port.
- Changes to upload, auth, filesystem, or origin path handling require focused trust-boundary regression tests.
