const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');

const slugify = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const text = (max = 300, required = false) => ({ type: 'text', max, required });
const choice = (values, fallback) => ({ type: 'choice', values, fallback });
const bool = fallback => ({ type: 'boolean', fallback });
const number = (min, max, fallback) => ({ type: 'number', min, max, fallback });
const image = { type: 'image', fallback: '' };
const url = { type: 'url', fallback: '' };
const date = { type: 'date', fallback: null };
const movies = { type: 'movies', fallback: [] };
const common = { enabled: bool(true), order: number(0, 100000, 0) };
const seo = { seo_title: text(300), seo_description: text(1000), keywords: text(2000), canonical: url, og_image: image };
const article = { title: text(300, true), slug: { type: 'slug' }, body: text(100000), excerpt: text(2000), image, status: choice(['draft', 'published', 'scheduled'], 'draft'), publish_at: date, ...seo };
const person = { name: text(200, true), slug: { type: 'slug' }, image, biography: text(10000), country: text(100), movie_slugs: movies, ...common };
const definitions = {
  'video-servers': { storage: 'video_servers', permission: 'video-server', fields: { name: text(200, true), base_url: url, is_default: bool(false), ...common } },
  actors: { storage: 'actors', permission: 'actor', fields: person },
  directors: { storage: 'directors', permission: 'director', fields: person },
  trending: { storage: 'trending', permission: 'trending', fields: { title: text(200, true), period: choice(['today', 'week', 'month', 'views', 'rating', 'featured'], 'week'), movie_slugs: movies, ...common } },
  homepage: { storage: 'homepage_sections', permission: 'homepage', fields: { title: text(200, true), key: { type: 'slug' }, movie_slugs: movies, limit: number(1, 100, 12), ...common } },
  banners: { storage: 'banners', permission: 'banner', fields: { title: text(300), description: text(2000), image: { ...image, required: true }, slug: { type: 'movie', required: true }, ...common } },
  schedule: { storage: 'schedule', permission: 'schedule', fields: { title: text(300, true), movie_slug: { type: 'movie', required: true }, episode: text(100), publish_at: { ...date, required: true }, status: choice(['planned', 'released', 'cancelled'], 'planned'), ...common } },
  notifications: { storage: 'site_notifications', permission: 'notification', fields: { title: text(300, true), body: text(10000), type: choice(['movie', 'episode', 'maintenance', 'system', 'update'], 'system'), movie_slug: { type: 'movie' }, publish_at: date, ...common } },
  ads: { storage: 'ads', permission: 'ad', fields: { title: text(300, true), image: { ...image, required: true }, link: { ...url, required: true }, position: choice(['header', 'sidebar', 'player', 'footer'], 'sidebar'), starts_at: date, ends_at: date, ...common } },
  posts: { storage: 'posts', permission: 'post', fields: { ...article, category: choice(['news', 'review', 'introduction', 'top', 'announcement', 'guide'], 'news') } },
  pages: { storage: 'pages', permission: 'page', fields: article },
  languages: { storage: 'languages', permission: 'language', fields: { name: text(100, true), code: { type: 'language', required: true }, is_default: bool(false), ...common } },
};

class ContentError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function webUrl(value) {
  try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password; } catch { return false; }
}
function imageUrl(value) {
  return webUrl(value) || /^\/storage\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..') || /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length <= 1400000;
}
// Only routable internet addresses may be used for server-side video probes.
function privateAddress(address) {
  const raw = String(address).toLowerCase().replace(/^\[|\]$/g, '');
  if (net.isIP(raw) === 4) {
    const [a, b] = raw.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 || b === 0 || b === 2) || a === 100 && b >= 64 && b <= 127 || a === 198 && [18, 19, 51].includes(b) || a === 203 && b === 0;
  }
  if (net.isIP(raw) === 6) return !/^[23][0-9a-f]{3}:/.test(raw) || /^2001:(?:db8|0|10|20):/.test(raw) || raw.startsWith('2002:');
  return true;
}
async function inspectVideoUrl(value, dependencies = {}) {
  if (!webUrl(value)) throw new ContentError('Link video phải là URL http/https hợp lệ.');
  const resolver = dependencies.lookup || dns.lookup;
  let target = new URL(value);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const host = target.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (target.username || target.password || !['http:', 'https:'].includes(target.protocol) || target.port && !['80', '443'].includes(target.port) || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) throw new ContentError('Không thể kiểm tra địa chỉ nội bộ hoặc cổng không được phép.');
    let addresses;
    try { addresses = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] : await resolver(host, { all: true, verbatim: true }); } catch { return { reachable: false, status: null, error: 'Không phân giải được tên miền.' }; }
    if (!addresses.length || addresses.some(record => privateAddress(record.address))) throw new ContentError('Địa chỉ video phải nằm trên Internet công khai.');
    const address = addresses[0];
    const result = await new Promise(resolve => {
      const transport = target.protocol === 'https:' ? https : http;
      // Pin the already-validated address; do not resolve again during connection.
      const request = (dependencies.request || transport.request)(target, {
        method: 'HEAD', agent: false, timeout: 6000,
        headers: { 'User-Agent': 'MovieAdmin-LinkCheck/1.0', Accept: '*/*' },
        lookup: (hostname, options, callback) => options?.all ? callback(null, [address]) : callback(null, address.address, address.family),
      }, response => { response.resume(); resolve({ status: response.statusCode, location: response.headers.location }); });
      request.once('timeout', () => request.destroy(new Error('timeout')));
      request.once('error', () => resolve({ status: null, error: 'Không kết nối được máy chủ trong thời gian cho phép.' }));
      request.end();
    });
    if ([301, 302, 303, 307, 308].includes(result.status) && result.location) {
      if (redirects === 3) return { reachable: false, status: result.status, error: 'Quá nhiều lần chuyển hướng.' };
      try { target = new URL(result.location, target); } catch { return { reachable: false, status: result.status, error: 'Địa chỉ chuyển hướng không hợp lệ.' }; }
      continue;
    }
    return { reachable: result.status >= 200 && result.status < 400, status: result.status, error: result.error || (result.status === 405 ? 'Máy chủ không hỗ trợ HEAD; chưa xác định khả năng phát video.' : result.status >= 400 ? `Máy chủ trả về HTTP ${result.status}.` : null), checked_url: target.href };
  }
}

module.exports = function adminContent(app, db, save, { auth, requirePermission }) {
  for (const definition of Object.values(definitions)) db[definition.storage] ||= [];
  db.activity_logs ||= [];
  const now = () => new Date().toISOString();
  const visibleMovie = slug => db.movies.find(movie => movie.slug === slug && !movie.deleted && !movie.hidden && movie.status !== 'hidden');
  const ordered = items => items.slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
  const active = item => !item.deleted && item.enabled !== false;
  const published = item => !item.deleted && (item.status === 'published' || item.status === 'scheduled' && item.publish_at && Date.parse(item.publish_at) <= Date.now());
  const activeAd = item => active(item) && (!item.starts_at || Date.parse(item.starts_at) <= Date.now()) && (!item.ends_at || Date.parse(item.ends_at) > Date.now());
  function log(req, action, collection, id) {
    db.activity_logs.push({ id: crypto.randomUUID(), userId: req.user.id, name: req.user.name, action: `${collection}.${action}`, target: id, date: now(), result: 'success' });
  }
  function guard(action) {
    return [auth, (req, res, next) => {
      const definition = definitions[req.params.collection];
      if (!definition) return res.status(404).json({ error: 'Không tìm thấy loại nội dung.' });
      req.contentDefinition = definition;
      return requirePermission(`${definition.permission}.${action}`)(req, res, next);
    }];
  }
  const handle = handler => async (req, res, next) => {
    try { await handler(req, res); } catch (error) { if (error instanceof ContentError) res.status(error.status).json({ error: error.message }); else next(error); }
  };
  function itemFor(req, allowDeleted = false) {
    const item = db[req.contentDefinition.storage].find(entry => entry.id === req.params.id && (allowDeleted || !entry.deleted));
    if (!item) throw new ContentError('Không tìm thấy nội dung.', 404);
    return item;
  }
  function validate(collection, body, previous = {}) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ContentError('Dữ liệu phải là một đối tượng JSON.');
    const definition = definitions[collection];
    const fields = definition.fields;
    for (const key of Object.keys(body)) if (!Object.hasOwn(fields, key)) throw new ContentError(`Trường không được phép: ${key}.`);
    const result = {};
    for (const [key, rule] of Object.entries(fields)) {
      let value = Object.hasOwn(body, key) ? body[key] : Object.hasOwn(previous, key) ? previous[key] : rule.fallback;
      if (value === undefined) value = rule.type === 'slug' ? slugify(body.name || body.title || previous.name || previous.title) : '';
      if (rule.required && (value === '' || value === null || value === undefined)) throw new ContentError(`Vui lòng nhập ${key}.`);
      if (rule.type === 'text' || rule.type === 'slug' || rule.type === 'language') {
        if (typeof value !== 'string' || value.length > (rule.max || 200)) throw new ContentError(`${key} không hợp lệ hoặc quá dài.`);
        value = value.trim();
        if (rule.required && !value) throw new ContentError(`Vui lòng nhập ${key}.`);
        if (rule.type === 'slug' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw new ContentError(`${key} chỉ gồm chữ thường, số và dấu gạch ngang.`);
        if (rule.type === 'language' && !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(value)) throw new ContentError('Mã ngôn ngữ không hợp lệ, ví dụ vi hoặc en.');
      } else if (rule.type === 'boolean') {
        if (typeof value !== 'boolean') throw new ContentError(`${key} phải là true hoặc false.`);
      } else if (rule.type === 'number') {
        if (!Number.isInteger(value) || value < rule.min || value > rule.max) throw new ContentError(`${key} phải là số nguyên từ ${rule.min} đến ${rule.max}.`);
      } else if (rule.type === 'choice') {
        if (!rule.values.includes(value)) throw new ContentError(`${key} không nằm trong các giá trị cho phép.`);
      } else if (rule.type === 'image' || rule.type === 'url') {
        if (typeof value !== 'string' || value && !(rule.type === 'image' ? imageUrl(value) : value.length <= 4000 && webUrl(value))) throw new ContentError(`${key} phải là URL ${rule.type === 'image' ? 'ảnh raster' : 'http/https'} hợp lệ.`);
      } else if (rule.type === 'date') {
        if (value === '') value = null;
        if (value !== null && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))) throw new ContentError(`${key} phải là thời gian ISO có múi giờ.`);
        if (value) value = new Date(value).toISOString();
      } else if (rule.type === 'movies') {
        if (!Array.isArray(value) || value.length > 1000 || value.some(slug => typeof slug !== 'string' || !db.movies.some(movie => movie.slug === slug && !movie.deleted)) || new Set(value).size !== value.length) throw new ContentError(`${key} phải là danh sách slug phim tồn tại, không trùng nhau.`);
        value = value.slice();
      } else if (rule.type === 'movie') {
        if (typeof value !== 'string' || value && !db.movies.some(movie => movie.slug === value && !movie.deleted)) throw new ContentError(`${key} phải liên kết đến phim tồn tại.`);
      }
      result[key] = value;
    }
    for (const key of ['slug', 'key', 'code']) if (fields[key] && fields[key].type !== 'movie' && db[definition.storage].some(item => item[key] === result[key] && item.id !== previous.id)) throw new ContentError(`${key} đã tồn tại.`, 409);
    if (result.is_default && result.enabled === false) throw new ContentError('Mục mặc định cần được bật.');
    if (result.status === 'scheduled' && !result.publish_at) throw new ContentError('Cần chọn thời gian xuất bản.');
    if (result.starts_at && result.ends_at && result.ends_at <= result.starts_at) throw new ContentError('Thời gian kết thúc phải sau thời gian bắt đầu.');
    return result;
  }
  function applyDefaults(definition, item) {
    if (item.is_default) for (const other of db[definition.storage]) if (other.id !== item.id) other.is_default = false;
  }
  const apiBase = '/api/admin/content/:collection';
  app.get(apiBase, ...guard('view'), handle((req, res) => {
    const term = String(req.query.q || '').toLowerCase();
    let items = db[req.contentDefinition.storage].filter(item => req.query.trash === 'true' ? item.deleted : !item.deleted);
    if (term) items = items.filter(item => ['name', 'title', 'body', 'slug', 'code'].some(key => String(item[key] || '').toLowerCase().includes(term)));
    items = ordered(items);
    if (['actors', 'directors'].includes(req.params.collection)) items = items.map(item => ({ ...item, movie_count: (item.movie_slugs || []).filter(slug => db.movies.some(movie => movie.slug === slug && !movie.deleted)).length }));
    res.json({ items });
  }));
  app.put(`${apiBase}/order`, ...guard('update'), handle((req, res) => {
    const { ids } = req.body;
    const entries = db[req.contentDefinition.storage];
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.length > 10000 || ids.some(id => typeof id !== 'string' || !entries.some(item => item.id === id && !item.deleted))) throw new ContentError('Danh sách ID cần gồm những mục đang hoạt động, không trùng nhau.');
    const remainder = ordered(entries.filter(item => !item.deleted && !ids.includes(item.id)));
    [...ids.map(id => entries.find(item => item.id === id)), ...remainder].forEach((item, order) => { item.order = order; item.updated_at = now(); });
    log(req, 'reorder', req.params.collection, ids.join(',')); save(); res.json({ items: ordered(entries.filter(item => !item.deleted)) });
  }));
  app.post(apiBase, ...guard('create'), handle((req, res) => {
    const data = validate(req.params.collection, req.body);
    const item = { ...data, id: crypto.randomUUID(), created_at: now(), updated_at: now(), deleted: false };
    if (req.params.collection === 'ads') Object.assign(item, { impressions: 0, clicks: 0, daily: {} });
    db[req.contentDefinition.storage].push(item); applyDefaults(req.contentDefinition, item);
    log(req, 'create', req.params.collection, item.id); save(); res.status(201).json(item);
  }));
  app.get(`${apiBase}/:id`, ...guard('view'), handle((req, res) => res.json(itemFor(req))));
  for (const method of ['put', 'patch']) app[method](`${apiBase}/:id`, ...guard('update'), handle((req, res) => {
    const item = itemFor(req);
    Object.assign(item, validate(req.params.collection, req.body, item), { updated_at: now() });
    applyDefaults(req.contentDefinition, item); log(req, 'update', req.params.collection, item.id); save(); res.json(item);
  }));
  app.delete(`${apiBase}/:id`, ...guard('delete'), handle((req, res) => {
    const item = itemFor(req); item.deleted = true; item.deleted_at = now(); item.updated_at = now();
    if (item.is_default) item.is_default = false;
    log(req, 'delete', req.params.collection, item.id); save(); res.json({ ok: true });
  }));
  app.post(`${apiBase}/:id/restore`, ...guard('update'), handle((req, res) => {
    const item = itemFor(req, true);
    if (!item.deleted) throw new ContentError('Nội dung này không nằm trong thùng rác.');
    item.deleted = false; delete item.deleted_at; item.updated_at = now(); log(req, 'restore', req.params.collection, item.id); save(); res.json(item);
  }));
  const checks = new Map();
  app.post(`${apiBase}/:id/check`, ...guard('update'), handle(async (req, res) => {
    if (req.params.collection !== 'video-servers') throw new ContentError('Không có chức năng kiểm tra cho nội dung này.', 404);
    const item = itemFor(req);
    if (Date.now() - (checks.get(req.user.id) || 0) < 3000) throw new ContentError('Vui lòng đợi 3 giây trước lần kiểm tra tiếp theo.', 429);
    checks.set(req.user.id, Date.now());
    const result = await inspectVideoUrl(req.body.url || item.base_url);
    item.last_check = { ...result, checked_at: now() }; item.updated_at = now();
    log(req, 'check', req.params.collection, item.id); save(); res.json(item.last_check);
  }));
  function safeItem(collection, item) {
    const result = { id: item.id };
    for (const key of Object.keys(definitions[collection].fields)) if (item[key] !== undefined) result[key] = item[key];
    if (Array.isArray(result.movie_slugs)) result.movie_slugs = result.movie_slugs.filter(slug => visibleMovie(slug));
    return result;
  }
  function publicContent() {
    const content = {};
    for (const [collection, definition] of Object.entries(definitions)) {
      let items = db[definition.storage].filter(active);
      if (collection === 'posts' || collection === 'pages') items = items.filter(published);
      if (collection === 'ads') items = items.filter(activeAd);
      if (collection === 'banners') items = items.filter(item => visibleMovie(item.slug));
      if (collection === 'schedule') items = items.filter(item => item.status !== 'cancelled' && visibleMovie(item.movie_slug));
      if (collection === 'notifications') items = items.filter(item => (!item.publish_at || Date.parse(item.publish_at) <= Date.now()) && (!item.movie_slug || visibleMovie(item.movie_slug)));
      content[collection === 'video-servers' ? 'video_servers' : collection] = ordered(items).map(item => {
        const value = safeItem(collection, item);
        if (collection === 'video-servers') delete value.base_url;
        if (collection === 'posts' || collection === 'pages') { delete value.body; value.created_at = item.created_at; }
        return value;
      });
    }
    return content;
  }
  app.get('/api/content', (req, res) => res.json(publicContent()));
  for (const collection of ['posts', 'pages']) app.get(`/api/content/${collection}/:slug`, (req, res) => {
    const item = db[collection].find(entry => entry.slug === req.params.slug && published(entry));
    if (!item) return res.status(404).json({ error: 'Không tìm thấy nội dung.' });
    res.json({ ...safeItem(collection, item), created_at: item.created_at, updated_at: item.updated_at });
  });
  const adEvents = new Map();
  app.post('/api/content/ads/:id/:event', (req, res) => {
    if (!['impression', 'click'].includes(req.params.event)) return res.status(404).json({ error: 'Không tìm thấy sự kiện.' });
    const ad = db.ads.find(item => item.id === req.params.id && activeAd(item));
    if (!ad) return res.status(404).json({ error: 'Không tìm thấy quảng cáo đang hoạt động.' });
    const key = crypto.createHash('sha256').update(`${req.ip}:${ad.id}:${req.params.event}`).digest('hex');
    const time = Date.now();
    for (const [eventKey, expires] of adEvents) if (expires < time) adEvents.delete(eventKey);
    if (adEvents.has(key)) return res.json({ ok: true, counted: false });
    adEvents.set(key, time + 5 * 60000);
    const field = req.params.event === 'impression' ? 'impressions' : 'clicks';
    ad[field] = Number(ad[field] || 0) + 1; ad.daily ||= {};
    const day = now().slice(0, 10); ad.daily[day] ||= { impressions: 0, clicks: 0 }; ad.daily[day][field]++;
    save(); res.json({ ok: true, counted: true });
  });
  return { definitions, publicContent, validate };
};
module.exports.definitions = definitions;
module.exports.privateAddress = privateAddress;
module.exports.inspectVideoUrl = inspectVideoUrl;
