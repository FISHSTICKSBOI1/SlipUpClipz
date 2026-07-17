# Releasing SlipUpClipz (Windows)

This guide explains how to publish a new version so older installed copies can update automatically from GitHub Releases.

Repository: `FISHSTICKSBOI1/SlipUpClipz`

## What gets published

Every release must include these GitHub Release assets:

| Asset | Purpose |
| --- | --- |
| `SlipUpClipz-Setup-<version>.exe` | Installer (spaces become dashes on GitHub) |
| `SlipUpClipz-Setup-<version>.exe.blockmap` | Differential update map |
| `latest.yml` | Update metadata read by electron-updater |

Locally, electron-builder creates:

- `release/SlipUpClipz Setup <version>.exe`
- `release/SlipUpClipz Setup <version>.exe.blockmap`
- `release/latest.yml`

`latest.yml` must list the **published** (hyphenated) installer name. The verify script checks this.

## Before you start

1. Finish and test your changes.
2. Open `package.json` and **increase the version** (example: `0.1.2` → `0.1.3`).
3. Create a GitHub Personal Access Token with permission to upload release assets.
4. Do **not** put the token in the app or commit it to git.

## Publish steps (Command Prompt)

Open **Command Prompt** in the project folder:

```bat
cd C:\Users\FISHS\Projects\SlipUpClipz
```

Set your token for this window only:

```bat
set GH_TOKEN=paste_your_token_here
```

Run the full release command:

```bat
npm run release
```

That command will:

1. Check that the version is new and safe to publish
2. Delete the old local `release/` folder
3. Build the app
4. Create a fresh NSIS installer, blockmap, and `latest.yml`
5. Verify those files match
6. Upload them to GitHub Releases

## Confirm on GitHub

1. Open: https://github.com/FISHSTICKSBOI1/SlipUpClipz/releases
2. Open the newest release (tag like `v0.1.3`)
3. Confirm Assets include:
   - installer (`.exe`)
   - blockmap (`.exe.blockmap`)
   - `latest.yml`
4. Open `latest.yml` and confirm `version:` matches `package.json`

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run release:clean` | Deletes local `release/` output |
| `npm run package` | Builds installer locally (no upload) |
| `npm run verify:release` | Checks installer / blockmap / `latest.yml` match |
| `npm run preflight:release` | Checks version + GitHub before publishing |
| `npm run release` | Clean → build → verify → publish |

## Test auto-update (two computers)

1. **Computer A** already has SlipUpClipz `0.1.2` installed.
2. On your build PC, set `package.json` to `0.1.3`, set `GH_TOKEN`, run `npm run release`.
3. On Computer A, open the installed `0.1.2` app.
4. Wait a few seconds, or open **Settings → Updates** and click **Check for Updates**.
5. Confirm it detects `0.1.3`, downloads it, and shows progress.
6. When prompted: **“A SlipUpClipz update is ready. Restart now to install?”**
   - Choose **Restart Now**, or **Later** and use **Restart and Install** in Settings.
7. After restart, Settings should show version `0.1.3`.
8. Confirm clips, settings, hotkeys, and license state are still there.

## Notes

- Updates only run in **installed packaged builds**, not `npm run dev`.
- Choosing **Later** keeps the app usable while gaming or recording.
- Never reuse an old version number. Always bump `package.json` first.
- If publish fails because a release already exists, bump the version or delete that GitHub release, then try again.
- If packaging fails with `EPERM` / rename `win-unpacked.tmp`, close SlipUpClipz and any `npm run dev` Electron windows, delete the `release` folder, then run `npm run package` again.
