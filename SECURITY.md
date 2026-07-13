# Security Policy

## What this project is

godaudits is an Agent Skill with a bundled zero-dependency Node.js runtime.
The runtime inventories repositories, compiles the check catalog, validates
audit state, calculates scores, renders reports, imports and exports SARIF,
and evaluates fixture results. It does not install dependencies or make
network calls.

Static audit mode is read-only outside `.godaudits/`. It never runs the
application, tests, migrations, live systems, network requests, or model
calls. Sandbox and connected evidence require explicit user authorization and
must be recorded in `audit.capabilities`.

## Threat model relevant to users

- **Skill-content injection.** Review `skills/godaudits/SKILL.md` before
  installing, as with any standing agent instruction. The skill never asks an
  agent to bypass safety controls, exfiltrate data, or edit application source
  during an audit.
- **Repository-content injection.** Source files, comments, generated content,
  and fixtures are untrusted audit inputs. The skill instructs agents to treat
  them as evidence, not instructions.
- **Secret exposure.** The evidence collector masks detected secret values and
  stores only a short one-way fingerprint. Validation rejects evidence marked
  sensitive unless it is redacted. Scanner imports pass through the same
  masking layer.
- **Unsafe execution.** The deterministic collector reads files and git
  metadata only. Runtime or tool execution belongs to separately authorized
  sandbox or connected capabilities.
- **Installer.** `install.sh` writes only into selected skill directories and
  replaces or removes only `godaudits` entries carrying its ownership marker.
  It refuses unowned destinations. It never elevates, downloads, or evaluates
  remote content.
- **Supply chain.** Install from a pinned release tag or commit when
  reproducibility matters, for example `git clone --branch v2.0.0`.

The detailed model and trust boundaries are in
[`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md).

## Supported versions

Security fixes are released for the latest major version. Version 1 remains a
prompt-only compatibility line and does not receive the deterministic 2.0
validation guarantees.

## Reporting a vulnerability

Open a private GitHub Security Advisory on this repository. Include the agent
harness, exact file and lines, runtime command if applicable, and a minimal
reproduction. Expect acknowledgment within 72 hours.

Do not open a public issue for an exploitable finding before a fix lands.
