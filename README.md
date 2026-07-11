# Japanese Learning Tool

## Folder Structure

- `frontend/` - Current website files for GitHub and Vercel.
- `frontend/data/` - Required learning data used by the website.
- `backend/` - Future/optional service retained outside the public MVP; the current MVP does not require it.
- `DEPLOYMENT.md` - Deployment notes.
- `DESIGN.md` - Design direction and UI rules.

## Frontend Files To Publish

Upload or deploy the contents of `frontend/`:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- `analytics.js`
- `data/`
- `vercel.json`

Do not upload `node_modules/`, `.DS_Store`, or old generated output folders.

## Vercel

When importing the GitHub repository in Vercel, use `frontend/` as the project
root if the full project is uploaded. If only the `frontend/` folder is in the
GitHub repository, keep the root directory as the repository root.

Use:

- Framework Preset: `Other`
- Build Command: empty
- Output Directory: `.`
