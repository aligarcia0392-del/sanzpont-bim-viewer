// Service worker de Sanzpont BIM Viewer: guarda el programa del visor para abrirlo sin conexión.
// Estrategia: red primero (así siempre llega la última versión) y, si no hay red, la copia guardada.
// Las peticiones a Supabase (cuentas y modelos) no pasan por aquí; los modelos se guardan en IndexedDB.
const CACHE = 'sanzpont-app-a85c9b9f514d';
const SHELL = ['./', './index.html', './viewer.html', './viewer.js', './shell.js', './version.json', './logo.svg',
  './fonts/ibm-plex-sans-400.woff2', './fonts/ibm-plex-sans-500.woff2', './fonts/ibm-plex-sans-600.woff2',
  './fonts/ibm-plex-mono-400.woff2', './fonts/ibm-plex-mono-500.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const fixed = u.searchParams.has('v') || /\/fonts\/|logo\.svg$/.test(u.pathname);
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    // archivos con versión en el nombre (?v=…), fuentes y logo: primero la copia guardada (instantáneo)
    if (fixed) { const hit = await c.match(e.request); if (hit) return hit; }
    try {
      // páginas: red primero pero sin esperar de más; si tarda, se usa la copia guardada
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), fixed ? 8000 : 1500);
      const r = await fetch(e.request, { signal: ctl.signal, cache: fixed ? 'default' : 'no-cache' }); clearTimeout(t);
      if (r.ok) c.put(e.request.mode === 'navigate' ? new Request(u.pathname) : e.request, r.clone());
      return r;
    } catch {
      return (await c.match(e.request, { ignoreSearch: !fixed })) || (e.request.mode === 'navigate' ? (await c.match(u.pathname)) || await c.match('./index.html') : Response.error());
    }
  })());
});
