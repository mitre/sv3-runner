# Security Policy

The MITRE SAF team takes security seriously. If you discover a security vulnerability in sv3-runner, please report it responsibly.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report them through one of these private channels:

- **Email**: [saf-security@mitre.org](mailto:saf-security@mitre.org)
- **GitHub**: Use the [Security tab](https://github.com/mitre/sv3-runner/security) to report a vulnerability privately

### What to Include

When reporting, please provide as much of the following as you can:

1. **Description** of the vulnerability and its type
2. **Steps to reproduce** — full paths of affected source files, tag/branch/commit, and any special configuration
3. **Potential impact** assessment
4. **Proof-of-concept** or suggested fix (if you have one)

### Response Timeline

- **Acknowledgment**: within 48 hours
- **Initial assessment**: within 7 days
- **Fix timeline**: varies by severity

## Scope

sv3-runner is tooling that downloads, extracts, and launches DISA's STIG Viewer 3 (SV3) with a local Electron runtime. Security-relevant surfaces in **this project** are:

- The setup pipeline (`scripts/setup.mjs`) — downloading the SV3 zip from the DISA CDN, extracting the `app.asar`, and rebuilding the native `sqlite3` module.
- The launch path (`scripts/run.mjs`).
- This project's dependency tree (Electron, `@electron/rebuild`, `@electron/asar`, `sqlite3`).

STIG Viewer 3 itself is a U.S. Government (DISA) product that this project does **not** vendor or modify — vulnerabilities in SV3 should be reported to DISA. Report issues in the sv3-runner tooling here.

## Best Practices for Users

- **Keep updated** — use the latest version of sv3-runner and Node.js 24.x.
- **Verify downloads** — SV3 is fetched over HTTPS from the official DISA CDN (`dl.dod.cyber.mil`). Do not point the runner at untrusted mirrors.
- **Review dependencies** — run `npm audit` after `npm install` and before publishing changes.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅ Yes    |
| < 1.0   | ❌ No     |
