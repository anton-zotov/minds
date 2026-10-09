import { createApiServer } from './api.ts';
const port = Number(process.env.PLAYBOX_API_PORT ?? 5184);
createApiServer().listen(port, '127.0.0.1', () => console.log(`Playbox API: http://127.0.0.1:${port}`));
