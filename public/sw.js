// FitPlan Service Worker —— 离线优先
// 仅在生产构建下注册（见 src/main.tsx）
// 使用相对路径解析，部署在根路径或子目录下都能正常离线运行
const CACHE = 'fitplan-v2'
const SCOPE_URL = new URL('.', self.location.href)
const u = (p) => new URL(p, SCOPE_URL).href

const APP_SHELL = [u(''), u('index.html'), u('manifest.webmanifest'), u('icon-192.png'), u('icon-512.png')]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // 导航请求：网络优先，失败回退 index.html（保证离线刷新可用）
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(u('index.html'), copy))
          return res
        })
        .catch(() => caches.match(u('index.html')).then((r) => r || caches.match(u('')))),
    )
    return
  }

  // 构建产物（文件名带哈希，内容不变）：缓存优先，离线秒开
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  // 其他静态资源：stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
