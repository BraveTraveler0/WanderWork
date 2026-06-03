const LOCAL_URL_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i;

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function safePublicUrl(values, fallback) {
  const urls = Array.isArray(values) ? values : [values];
  for (const value of urls) {
    const url = normalizeBaseUrl(value);
    if (!url) continue;
    if (LOCAL_URL_RE.test(url)) continue;
    return url;
  }
  return normalizeBaseUrl(fallback);
}

function getPublicAppUrl() {
  return safePublicUrl(process.env.APP_URL, 'https://wanderwork.io');
}

function getPublicServerUrl() {
  return safePublicUrl(
    [process.env.PUBLIC_SERVER_URL, process.env.SERVER_URL],
    'https://wanderwork-backend-server.onrender.com'
  );
}

module.exports = {
  safePublicUrl,
  getPublicAppUrl,
  getPublicServerUrl,
};
