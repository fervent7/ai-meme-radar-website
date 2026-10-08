# AI Meme Radar — Website V1

This is the **public frontend only**. Do not add the Python Radar source, Telegram credentials, API keys or other secrets to this repository.

## Android deployment
1. Create a **new** GitHub repository, e.g. `ai-meme-radar-website` (separate from the private backend repo).
2. Extract this ZIP on Android and upload `index.html`, `styles.css`, `app.js`, and `config.js` individually into the root of the new repo (GitHub > Add file > Upload files > Commit changes). README.md is optional.
3. On Render choose **New > Static Site**, connect this new repository, branch `main`, root directory blank, **Build Command** `echo 'Static website ready'`, **Publish Directory** `.`. Deploy.
4. Open the assigned `https://<name>.onrender.com` website. No custom domain purchase is needed yet.
5. To enable live Radar data, edit `config.js` on GitHub and set `window.RADAR_API_BASE = "https://YOUR-EXISTING-BACKEND.onrender.com";` and commit. Do not put `/api/status` or `/research` in this URL.
6. If browser data fails to load but backend `/api/status` works directly, your FastAPI backend may need an **allowlisted CORS origin** for the new website address. Do not use unrestricted `*` origins on authenticated endpoints. Ask for a safe backend patch; do not disable security controls.
7. Research search opens the backend's existing `/research` page in a new tab. This avoids a new cross-origin search dependency while keeping backend logic unchanged. The backend page must support the query string for prefilling, otherwise select the chain/address there manually.

## Architecture
Website (Render Static Site) → public read-only `/api/status` → existing Radar (Render Web Service). Research → existing backend `/research`. The website cannot send Telegram alerts or modify backend filters.

## Future domain
`aimemeradar.com` is a preferred name, **not registered or verified available**. Once purchased, configure it in Render's Static Site > Settings > Custom Domains and follow your registrar's DNS instructions.

## Scope and limitations
- Current version is a working frontend, not a complete trading platform.
- The displayed backend status is best-effort; backend may be sleeping or rate limited.
- Token reports are research, not proof of safety, tradability or profitability.
- Community reputation, wallet clustering, accounts, and on-site member features are planned, not implemented.
