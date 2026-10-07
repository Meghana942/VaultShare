# VaultShare

**Secret Sharing Based Information Security System**

VaultShare encrypts a confidential file and splits the key among several people, so the file opens only when enough of them (for example any 3 of 5) approve. Fewer people learn nothing at all.

## What it does, in plain words

1. **You put a confidential file in**: a PDF, an image, or a secret note such as a master password.
2. **VaultShare locks it** with AES-256 encryption using a brand-new random key. The locked file is useless on its own.
3. **The key is broken into pieces** (Shamir's Secret Sharing), one piece per person: CEO, CTO, CFO and so on. Then the key itself is thrown away.
4. **Only a group can open it.** When enough people hand in their pieces, the key is rebuilt and the file opens. Two pieces reveal *nothing at all*, a fake piece is caught immediately, and every step is written to a tamper-evident log.

So nobody, not even the administrator or the server, can open a file alone. Two people can lose their piece and the file is still recoverable, and a stolen piece is worthless by itself.

## What is new here

Shamir's scheme dates from 1979, and this project does **not** claim the algorithm is new. The contribution is the system built around it:

| Component | What it adds |
|---|---|
| Hybrid encrypted vault | AES-256-GCM encrypts the file. Only the 32-byte key is split, so shares stay about 0.5 KB whatever the file size. |
| Role-based approval | Custodians approve by handing in their shares. A live *k / t* meter shows progress. |
| Verifiable shares (Feldman) | Each share is checked the moment it's submitted, so a fake share is caught and attributed to its custodian. |
| Force reconstruct | Runs the reconstruction with fewer than *t* shares and shows the result is random garbage, not a near-miss. |
| Share refresh | A new random polynomial with the same secret. Old shares stop working, and mixing old with new gives garbage. The key is never rebuilt during a refresh. |
| Visualize | The curve picture: 2 points fit infinitely many parabolas, 3 points fix exactly one. |
| Verified unlock | Key fingerprint, Feldman check and the AES-GCM tag must all agree. |
| Tamper-evident audit log | Hash-chained record of who did what, and when. |

## The app

| Screen | What you do there |
|---|---|
| Title screen | Press **Enter** (button or key) |
| **Vaults** | See all vaults, open one |
| **New Vault** | Name it, add a file or text, choose custodians and how many approvals are needed |
| Vault page | Custodians approve, **Unlock**, **Force reconstruct**, **Refresh shares** |
| **Visualize** | Click custodians to combine their shares and watch the curve |
| **Audit Log** | Every event, with an integrity check |

## Running it (Windows)

Requirements: Python 3.10+ and Node.js 20+.

**Easiest: double-click `start.cmd`** in the project folder. It opens two windows (API and UI) and then your browser at http://localhost:5173.

Or start each part yourself, in two terminals from the project folder:

```bash
.\run-backend.cmd
```

```bash
.\run-frontend.cmd
```

The scripts set everything up on first run (Python virtual environment, `pip install`, `npm install`), and they don't need the venv to be activated. The backend runs on port 8000 (API docs at http://localhost:8000/docs). Vite proxies `/api` there.

**Doing it by hand** (any OS). Run each line separately: Windows PowerShell 5.1 does **not** support `&&`.

```bash
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

On macOS/Linux use `.venv/bin/python` instead of `.venv\Scripts\python`. Then in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

**Tests:**

```bash
cd backend
.venv\Scripts\python -m pytest -q
```

The 19 tests include an exhaustive proof of perfect secrecy in GF(31), Feldman forgery detection, refresh behaviour, an end-to-end API flow, and audit-chain tamper detection.

### Troubleshooting

| Symptom | Fix |
|---|---|
| `The token '&&' is not a valid statement separator` | Windows PowerShell 5.1 has no `&&`. Run the commands one per line, or use `run-backend.cmd`. |
| `[WinError 10013] An attempt was made to access a socket…` | Port 8000 is already taken, usually by another copy of the backend. Close it (Ctrl+C in its window), or find it with `netstat -ano \| findstr :8000` and end that process in Task Manager. |
| `running scripts is disabled on this system` when activating the venv | You don't need to activate it: use `run-backend.cmd`, or call `.venv\Scripts\python -m uvicorn …` directly. |
| Header shows **Backend offline** | The backend isn't running. Start `run-backend.cmd`; the dot turns green within a few seconds. |
| You renamed the project folder and the backend broke | Delete `backend\.venv` and run `run-backend.cmd` again; it rebuilds the environment. |

## Demo script (about 5 minutes)

1. **Title screen.** Open http://localhost:5173 and press **Enter**.
2. **New Vault.** Upload a PDF or an image. Keep the 5 default custodians and 3 approvals. Click **Create vault**, then **Open vault**.
3. **Two approvals.** Click **Approve** for CEO and CTO. The meter shows **2 / 3** and **Unlock** stays disabled.
4. **"Isn't that just an if-statement?"** Click **Force reconstruct**. Result: **Wrong key**. The recovered value is a ~2047-bit number (a real key is 256-bit), the key check fails, decryption fails, and the file turns into noise.
5. **Fake share.** Under *Legal Counsel*, click **fake share**. It is rejected immediately (Feldman verification), and the audit log records it.
6. **Unlock.** Approve as CFO, then **Unlock**. All checks pass, the file appears, and the earlier forced attempt shows **about 128 of 256 bits wrong**: random, not a near-miss.
7. **Refresh shares.** The vault moves to *shares v2*. Click **old share** for CEO: rejected. Approve CTO and CFO, then **Force reconstruct**: old + new shares give garbage.
8. **Visualize.** Click two custodians: many curves fit and the secret is hidden. Click a third: one curve, secret found.
9. **Audit Log.** Every step is listed and the log shows *Integrity verified*.

Answers to likely viva questions are in **[VIVA_NOTES.md](VIVA_NOTES.md)**.

## Project layout

```
start.cmd            opens API + UI + browser (Windows)
run-backend.cmd      sets up and starts the FastAPI backend
run-frontend.cmd     sets up and starts the Vite dev server
VIVA_NOTES.md        explanations and likely viva questions
backend/
  app/
    params.py        RFC 3526 safe prime P = 2Q + 1, generator G = 4
    shamir.py        split, Lagrange reconstruct, refresh deltas (pure Python, ~60 lines of logic)
    feldman.py       commitments, share verification, commitment refresh
    crypto_box.py    AES-256-GCM, key fingerprint, unauthenticated "peek" for the garbage demo
    share_codec.py   share text format: svs1-<vault>-<version>-<x>-<hex y>
    vault_service.py create / submit / force / unlock / refresh workflow
    audit.py         hash-chained audit log
    storage.py       SQLite metadata and ciphertext blobs (no keys, no shares)
    main.py          FastAPI routes
  tests/             pytest suite
frontend/
  src/pages/         Landing, Dashboard, CreateVault, VaultRoom, Visualize, AuditLog
  src/lib/           api client, share helpers, custodian wallets (localStorage), curve maths
  src/components/    UI kit, logo + backend status, byte-noise canvas
  src/index.css      theme colors, fonts and animations (edit here to re-skin the app)
```

## Cryptographic design

- **Field:** shares are numbers mod Q, a 2047-bit prime, where `P = 2Q + 1` is the RFC 3526 2048-bit safe prime. Feldman needs the share field to be the order of a group where discrete log is hard. That is why the prime is much larger than the 256-bit key.
- **Split:** `f(x) = key + a₁x + a₂x² (mod Q)` with random `aᵢ`, non-zero leading coefficient. Share *i* is `(i, f(i))`.
- **Reconstruct:** `f(0) = Σ yᵢ · Lᵢ(0)`, where `Lᵢ(0) = Π (−xⱼ)/(xᵢ − xⱼ)` and division is a modular inverse.
- **Feldman:** publish `Cⱼ = G^aⱼ mod P`. A share is valid iff `G^y = Π Cⱼ^(xʲ) mod P`.
- **Refresh:** random `δ(x)` with `δ(0) = 0`. Each custodian computes `y' = y + δ(xᵢ)` locally (in `frontend/src/lib/shares.js`), and the commitments become `Cⱼ · G^δⱼ`.
- **At rest the server holds:** ciphertext, nonce, key fingerprint, Feldman commitments, and the audit log. **Never** the key, the coefficients, or any share.
- **During unlock:** submitted shares are held in server memory only and wiped after unlock, refresh, or reset.

## Known limitations / future work

- Custodians are identified by their share, not by a login. Per-custodian authentication (for example WebAuthn) is future work.
- The server is a trusted combiner during unlock. Client-side reconstruction or threshold decryption would remove that.
- Refresh uses a single dealer. Full proactive secret sharing (Herzberg et al., 1995) has every custodian contribute a zero-polynomial.
- Python cannot securely zero memory.
- Metadata (name, file name, size) is not encrypted.
- For the demo, all custodians' shares live in one browser's localStorage. Save the share files if you want backups.
