# Publish TWINBOUND v10.3.1

The complete game runs as a static website. Records live in each browser; the normal launcher and GitHub Pages do not use `server.py`, a score API, SQLite, or runtime API configuration. No hosting has been performed by this package.

## 1. Create the repository

1. Sign in to your own GitHub account and choose **New repository**.
2. Name it `TWINBOUND` (or your preferred name), choose **Public**, and create it. Leave automatic README/license creation unchecked if you will upload the supplied files with Git.
3. Install GitHub Desktop or Git if needed. Extract the entire supplied ZIP; open the folder containing `index.html`, `README.md`, `src/`, `data/` and `.github/`.
4. Make this folder the repository root. Upload the extracted contents, not the ZIP and not an extra enclosing directory. Git and GitHub Desktop preserve `.github/workflows/pages.yml`.

For an empty remote, these commands work from that project folder after replacing `YOUR_USERNAME` and, if needed, `TWINBOUND`:

```sh
git init
git branch -M main
git add .
git commit -m "Release TWINBOUND v10.3.1"
git remote add origin https://github.com/YOUR_USERNAME/TWINBOUND.git
git push -u origin main
```

Use Git's normal account sign-in when prompted. No credential belongs in project files. If you already cloned a nonempty repository, copy the contents into that clone, commit and push there instead; do not overwrite its history with these initialization commands. The supplied `.gitignore` excludes dependencies, `dist/`, databases and local environment files.

GitHub Desktop alternative: clone your new repository, copy the extracted contents into it (including `.github/`), review changes, commit and **Push origin**. Verify the workflow file is visible on GitHub before continuing.

## 2. Replace README placeholders

| Location in `README.md` | Replacement |
| --- | --- |
| Opening **Play TWINBOUND Online** URL | `https://YOUR_USERNAME.github.io/TWINBOUND/` with your actual account and repository name |
| Development `git clone` URL | `https://github.com/YOUR_USERNAME/TWINBOUND.git` with the same account/repository |
| Demo paragraph containing `YOUR_YOUTUBE_VIDEO_URL` | Replace the paragraph with `[Watch the 30-second Gameplay Demo](YOUR_ACTUAL_YOUTUBE_URL)` after uploading your video |
| Example URL/clone commands under deployment instructions | Replace the same account/repository tokens if you want directly reusable commands |

No fake YouTube ID or image thumbnail is supplied. The demo placeholder is plain text until you add the real video. The repository URL normally ends in `/TWINBOUND`; the game URL is on `github.io` and includes a trailing slash.

## 3. Enable GitHub Pages

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Open **Actions → Publish TWINBOUND to GitHub Pages**. Push a commit to `main`, or choose **Run workflow** on `main`.
4. The existing workflow checks out the source, runs the dependency-free Node unit suite, verifies bundled assets and scoring rules, and executes `python tools/build_static.py`.
5. It uploads **the contents of `dist/`**, including `index.html` at the artifact root, and deploys them with GitHub's Pages actions.
6. Wait for a successful deployment and open the URL shown by the deployment job or Settings → Pages. Save that exact URL in README. Future pushes to `main` repeat the workflow automatically.

The workflow declares `contents: read`, `pages: write` and `id-token: write` and uses GitHub's automatic token. You do not create or publish a personal API token. No Actions secret, `TWINBOUND_API_BASE`, Firebase, Supabase, external server or tunnel is needed.

If the workflow is absent, check `.github/workflows/pages.yml` is committed at the repository root. If the build succeeds but deployment is refused, check Pages is set to GitHub Actions and the repository/environment permits deployment from `main`. The workflow does not deploy pull requests or other branches.

Official references: [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## 4. Validate the public site

This remains an owner action after deployment; a local build does not prove a public deployment succeeded.

- Open the actual repository subpath, such as `https://YOUR_USERNAME.github.io/TWINBOUND/`.
- Check all four destination tabs and date-dependent reference transfers.
- Start a flight; check thrust/fuel, 2D/3D switching, sound after interaction, pause, and the automatic saved result.
- Play under a second Player ID in the same browser profile; confirm Local Leaderboard shows both and each report opens.
- Refresh; confirm records persist and My Flights changes with the current player.
- Inspect browser Network/Console for missing files or errors. There should be no score API requests.
- Open a separate browser/profile; its archive starts separately.

## Local use and static build

For Windows, double-click `start_windows.bat` with Python 3.10+ installed, or run `python run.py`. The launcher serves static files only, opens a browser and prints the address. Keep the console open. Use the same scheme, host and port on later visits; browser storage is origin-specific. `localhost` and `127.0.0.1` are different origins.

```sh
python run.py --port 8765 --no-browser
python tools/build_static.py
python -m http.server 9000 --directory dist
```

The default output is `dist/`; `--output /an/external/directory` is also supported. The builder copies the full game, Workers, data, images, license and technical documents. Old generated runtime API configuration is removed. Normal game files use repository-relative URLs. No source rewriting, reduced physics or CDN dependency is involved.

For a LAN static preview, `python run.py --host 0.0.0.0 --port 8765 --no-browser` allows other devices to open the host's address if permitted by the local network. Each browser still has its own records; connecting to one host does not create a shared leaderboard. Optional Docker/Caddy files serve the same static game; they are not required for Pages and were not deployed in this release.

The former API implementation, database backup helper and API tests remain as development history. They are not used by `run.py`, the game frontend or Pages. Existing browser archive IDs and profile keys are unchanged. The release does not import former server-only records into browsers.
