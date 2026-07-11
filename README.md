# Japanese Learning Tool

## Folder Structure

- `frontend/` - Current website files for GitHub and Vercel.
- `frontend/data/` - Required learning data used by the website.
- `backend/` - Future/optional service retained outside the public MVP; the current MVP does not require it.
- `DEPLOYMENT.md` - Deployment notes.
- `DESIGN.md` - Design direction and UI rules.

## Recommended Vercel Deployment

Import the repository root in Vercel. The root `vercel.json` runs `npm run build`
and publishes the generated `dist/` directory. This is the supported production
path and includes a build-time check that every local asset referenced by
`index.html` exists in the bundle.

Use:

- Framework Preset: `Other`
- Root Directory: repository root
- Build Command: `npm run build`
- Output Directory: `dist`

## Alternative Static Deployment

If a static host does not run the root build, publish the entire contents of
`frontend/`, including all CSS/JS files plus `assets/` and `data/`. Do not copy
only a hand-picked file list.

Do not publish `node_modules/`, `.DS_Store`, audit output, or old generated
folders.
