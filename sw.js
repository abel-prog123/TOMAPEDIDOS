const CACHE='frostech-v2';

self.addEventListener('install',e=>{
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  // Solo cachear requests http/https, ignorar chrome-extension y otros
  if(!e.request.url.startsWith('http')) return;
  if(e.request.url.includes('supabase.co')) return;
  if(e.request.url.includes('script.google.com')) return;
});
