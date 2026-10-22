// ═══════════════════════════════════════════════════════════
//  SERVICE WORKER — TomaPedidos
//
//  El problema del sw anterior: servia index.html desde el cache
//  antes de preguntarle al servidor. Resultado: alguien podia
//  seguir usando una version vieja durante dias y reportar errores
//  que ya estaban corregidos.
//
//  Este usa dos estrategias distintas, que es lo correcto:
//
//   · index.html  -> PRIMERO LA RED. Si hay internet, siempre trae
//                    la ultima version. El cache queda solo como
//                    respaldo para cuando no hay señal.
//   · lo demas    -> primero el cache (iconos, manifest), porque
//                    casi nunca cambian y asi la app abre rapido.
//
//  IMPORTANTE: al subir una version nueva de la app, cambiar
//  CACHE_VER por la fecha del dia. Eso borra el cache anterior.
// ═══════════════════════════════════════════════════════════

const CACHE_VER = 'tomapedidos-2026-10-22';
const ESENCIALES = ['./', './index.html', './manifest.json'];

// ── Instalacion: guardar lo minimo y pasar a activo enseguida ──
self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE_VER)
      .then(function(c){ return c.addAll(ESENCIALES).catch(function(){}); })
      .then(function(){ return self.skipWaiting(); })
  );
});

// ── Activacion: borrar los caches de versiones anteriores ──
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(ks){
      return Promise.all(ks.map(function(k){
        if(k !== CACHE_VER) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// ── Permite que la app pida tomar el control sin esperar ──
self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function(e){
  const req = e.request;

  // Solo GET del mismo origen. Las llamadas a Supabase y a los CDN
  // pasan de largo: nunca se cachean.
  if(req.method !== 'GET') return;
  let url;
  try{ url = new URL(req.url); }catch(err){ return; }
  if(url.origin !== self.location.origin) return;

  const esDocumento = req.mode === 'navigate'
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('.html');

  if(esDocumento){
    // PRIMERO LA RED: asi la version nueva llega apenas se publica
    e.respondWith(
      fetch(req, {cache:'no-store'})
        .then(function(res){
          const copia = res.clone();
          caches.open(CACHE_VER).then(function(c){ c.put(req, copia); });
          return res;
        })
        .catch(function(){
          // Sin internet: servir lo ultimo que se guardo
          return caches.match(req).then(function(r){
            return r || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Resto de archivos: cache primero, y se actualiza por detras
  e.respondWith(
    caches.match(req).then(function(hit){
      const red = fetch(req).then(function(res){
        if(res && res.status === 200){
          const copia = res.clone();
          caches.open(CACHE_VER).then(function(c){ c.put(req, copia); });
        }
        return res;
      }).catch(function(){ return hit; });
      return hit || red;
    })
  );
});
