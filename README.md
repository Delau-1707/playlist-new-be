# Backend Deployment

## Vercel

Import the backend Git repository as a separate Vercel project and set its Root Directory to `./`. Vercel detects the Express app exported from `index.js`; keep the default build settings and do not use `src/server.js` as the deployment entry point because it starts a local listener.

Add these environment variables in the Vercel project settings for Production (and Preview if needed):

```text
DATABASE_URL=<Neon connection string>
FRONTEND_URL=https://<frontend-deployment>.vercel.app
YOUTUBE_API_KEY=<YouTube API key>
AUDIUS_API_KEY=<Audius API key>
AUDIUS_BEARER_TOKEN=<Audius bearer token>
```

Set the frontend project's `NEXT_PUBLIC_API_URL` to `https://<backend-deployment>.vercel.app/api`. Apply `database/schema.sql` to the configured database before using playlist and history endpoints. Keep secret values in Vercel's environment settings, not in committed files.

After deployment, check `https://<backend-deployment>.vercel.app/api/health`.
