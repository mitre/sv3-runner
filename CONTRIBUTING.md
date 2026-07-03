# Contributing to sv3-runner

Thank you for considering contributing to sv3-runner! This project helps security engineers run DISA's STIG Viewer 3 (SV3) on platforms DISA doesn't ship a build for — most notably macOS.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](./CODE_OF_CONDUCT.md). Use welcoming language, respect differing viewpoints, accept constructive criticism gracefully, and focus on what is best for the community.

## How Can I Contribute?

### Reporting Bugs

Before filing a bug, search [existing issues](https://github.com/mitre/sv3-runner/issues). When you open one, please include:

- A clear, descriptive title
- Exact steps to reproduce
- Behavior you observed vs. behavior you expected
- Your environment: OS + arch (e.g. macOS 15 arm64), `node --version`, and the SV3 zip version
- Relevant output from `npm run setup -- --status` and any error logs

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. Provide a clear title, a detailed description, concrete examples, the current behavior, and how your suggestion improves it.

### Security Vulnerabilities

**Do not report security vulnerabilities through public GitHub issues.** See [SECURITY.md](./SECURITY.md) — report to **saf-security@mitre.org** or via the GitHub Security tab. You should receive a response within 48 hours.

## Development Process

### Prerequisites

- **Node.js 22.x** — SV3 uses Electron 40.1.0, whose native-module ABI requires Node 22. This is enforced by `engines` in `package.json`, `engine-strict=true` in `.npmrc`, and a runtime check in `setup.mjs`. Use a version manager (`mise`, `fnm`, `nvm`, `volta`, `asdf`) — see the README.
- A C toolchain for `node-gyp` (`@electron/rebuild` compiles `sqlite3` from source): Xcode Command Line Tools on macOS, `build-essential` + `python3` on Linux, Visual Studio Build Tools on Windows.

### Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork and add the upstream remote:
   ```bash
   git clone git@github.com:your-username/sv3-runner.git
   cd sv3-runner
   git remote add upstream git@github.com:mitre/sv3-runner.git
   ```
3. **Install and set up**:
   ```bash
   npm install
   npm run setup      # downloads SV3, extracts, rebuilds sqlite3, patches
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```

### Making Changes

The whole project is two scripts (`scripts/setup.mjs`, `scripts/run.mjs`) plus their shared library in `scripts/lib/` and the test suite in `test/`. There is no SV3 application code here to edit.

1. **Follow the coding standards** — ESLint (flat config, ESM) + Prettier:
   ```bash
   npm run lint       # eslint + prettier --check (must be clean)
   npm run format     # prettier --write
   ```
2. **Write tests first (TDD)** — every behavior change starts with a failing test. The suite is `node:test`:
   ```bash
   npm test               # unit + functional (test/**/*.test.mjs)
   npm run test:unit
   npm run test:functional
   npm run test:e2e       # Playwright _electron E2E (requires a completed npm run setup)
   ```
   Keep tests deterministic and pin assertions to specific expected values. Shell-outs are unit-tested by injecting a spy `run` into the pipeline steps — do not add duplicate runners or stub in ways that hide real behavior.
3. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`. Add files individually (do not `git add -A`).

### Submitting Changes

1. Push your branch to your fork.
2. Open a Pull Request against `mitre/sv3-runner` `main`, filling in the [PR template](./.github/PULL_REQUEST_TEMPLATE.md): what changed, related issues, and testing performed.
3. Ensure CI is green — the fast tier runs lint + `node:test` on every push and PR.
4. A maintainer will review; address requested changes, and once approved a maintainer will merge.

## Questions?

- Open a [GitHub Discussion](https://github.com/mitre/sv3-runner/discussions) or [issue](https://github.com/mitre/sv3-runner/issues)
- Email the team at [saf@mitre.org](mailto:saf@mitre.org)

---

<p align="center">
  Part of the <a href="https://saf.mitre.org/">MITRE Security Automation Framework</a>
</p>
