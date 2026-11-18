import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);

// In production the built web app sits next to the API in the monorepo.
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

createApp({ webDist: existsSync(webDist) ? webDist : undefined }).listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
