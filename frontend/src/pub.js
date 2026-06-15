// Resolve a public asset path that works both in dev (http) and in the
// packaged app (file://). Uses Vite's BASE_URL so paths are relative when
// base is './'.
export const pub = (p) => import.meta.env.BASE_URL + String(p).replace(/^\//, '');
