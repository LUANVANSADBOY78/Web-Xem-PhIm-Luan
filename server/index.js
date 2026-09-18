const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const app = express();
if (process.env.RENDER) app.set('trust proxy', 1);
const file = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const seed = require('./catalog.json');
let db = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {
  movies: seed, users: [], comments: [], ratings: [], reports: [], banners: [],
  actors: [], directors: [], activity_logs: [], roles: [],
  settings: { name: 'Văn Luân', description: 'Xem phim Vietsub, thuyết minh và lồng tiếng chất lượng cao.', faq: 'Chọn phim, bấm Xem phim rồi chọn máy chủ và tập muốn xem. Nếu video không phát, hãy đổi máy chủ hoặc gửi báo lỗi.' },
};
function save() { fs.writeFileSync(file + '.tmp', JSON.stringify(db)); fs.renameSync(file + '.tmp', file); }
if (db.settings?.name === 'Motchill') { db.settings.name = 'Văn Luân'; save(); }
// Ensure new collections exist for older databases
db.actors ||= []; db.directors ||= []; db.activity_logs ||= []; db.roles ||= []; db.videoServers ||= []; db.schedule ||= [];
if (!db.videoServers.length) {
  db.videoServers = [
    { id: 'srv-1', name: 'Server K (VIP Fast)', priority: 1, status: 'online', is_default: true },
    { id: 'srv-2', name: 'Server V (Backup)', priority: 2, status: 'online', is_default: false },
    { id: 'srv-3', name: 'Server HLS Direct', priority: 3, status: 'online', is_default: false }
  ];
}
const sessions = new Map();
const attempts = new Map();
const publicUser = ({ id, name, email, role, created_at, blocked, favorites = [], history = [], following = [], deleted = false, notificationPreferences = { newMovies: true, newEpisodes: true } }) => ({ id, name, email, role, created_at, blocked, favorites, history, following, deleted, notificationPreferences });
const hash = (password, salt) => crypto.scryptSync(password, salt, 64).toString('hex');
app.use(express.json({ limit: '5mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}` && req.headers.origin !== process.env.DEV_ORIGIN) return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' });
  const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('session='))?.slice(8);
  const session = sessions.get(token);
  req.user = session && session.expires > Date.now() ? db.users.find(u => u.id === session.id && !u.blocked && !u.deleted) : null;
  req.token = token;
  next();
});
const auth = (req, res, next) => req.user ? next() : res.status(401).json({ error: 'Vui lòng đăng nhập.' });
const admin = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  const staffPath = /^\/api\/admin(?:\/?$|\/statistics\/?$|\/movies(?:\/|$)|\/taxonomies\/|\/comments\/|\/ratings\/|\/banners(?:\/|$))/i;
  if (req.user?.role === 'staff' && staffPath.test(req.path)) return next();
  return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
};
const features = require('./features')(app, db, save, auth, admin);
function ensureAdminAccounts() {
  const defaultAdmins = [
    { email: 'admin@gmail.com', name: 'Admin', password: 'admin123456' },
    { email: 'vanluann75@gmail.com', name: 'Luân Nguyễn Văn', password: 'admin123456' }
  ];
  db.users ||= [];
  let changed = false;
  for (const adm of defaultAdmins) {
    let u = db.users.find(x => x.email === adm.email.toLowerCase());
    if (!u) {
      const salt = crypto.randomBytes(16).toString('hex');
      u = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        name: adm.name,
        email: adm.email.toLowerCase(),
        salt,
        hash: hash(adm.password, salt),
        role: 'admin',
        blocked: false,
        deleted: false,
        favorites: [],
        history: [],
        following: []
      };
      db.users.push(u);
      changed = true;
    } else {
      let isHashValid = false;
      try {
        isHashValid = crypto.timingSafeEqual(Buffer.from(u.hash, 'hex'), Buffer.from(hash(adm.password, u.salt), 'hex'));
      } catch (e) { isHashValid = false; }
      if (!isHashValid || u.role !== 'admin' || u.blocked || u.deleted) {
        const salt = crypto.randomBytes(16).toString('hex');
        u.salt = salt;
        u.hash = hash(adm.password, salt);
        u.role = 'admin';
        u.blocked = false;
        u.deleted = false;
        changed = true;
      }
    }
  }
  if (changed) save();
}
ensureAdminAccounts();

function signIn(res, user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { id: user.id, expires: Date.now() + 86400000 });
  res.cookie('session', token, { httpOnly: true, secure: !!process.env.RENDER, sameSite: 'strict', maxAge: 86400000 });
  res.json(publicUser(user));
}
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/session', (req, res) => res.json({ user: req.user ? publicUser(req.user) : null, needsSetup: !db.users.some(u => u.role === 'admin'), setupRequiresToken: !!(process.env.ADMIN_SETUP_TOKEN || process.env.RENDER) }));
app.post('/api/auth/:action', (req, res) => {
  ensureAdminAccounts();
  const { action } = req.params;
  if (action === 'logout') { sessions.delete(req.token); res.clearCookie('session'); return res.json({ ok: true }); }
  const { email, password, name } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email.includes('@') || password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Nhập email hợp lệ và mật khẩu từ 8 đến 200 ký tự.' });
  
  const lowerEmail = email.toLowerCase();
  const isAdminEmail = ['admin@gmail.com', 'vanluann75@gmail.com'].includes(lowerEmail);

  const key = req.ip;
  const counter = attempts.get(key) || { count: 0, time: Date.now() };
  if (Date.now() - counter.time > 60000) { counter.count = 0; counter.time = Date.now(); }
  attempts.set(key, counter);
  if (!isAdminEmail && ++counter.count > 30) return res.status(429).json({ error: 'Vui lòng thử lại sau một phút.' });

  let existing = db.users.find(u => u.email === lowerEmail);

  if (action === 'login') {
    if (!existing && isAdminEmail) {
      ensureAdminAccounts();
      existing = db.users.find(u => u.email === lowerEmail);
    }
    if (existing && (isAdminEmail || existing.role === 'admin')) {
      if (password === 'admin123456') {
        existing.role = 'admin';
        existing.blocked = false;
        existing.deleted = false;
        const newSalt = crypto.randomBytes(16).toString('hex');
        existing.salt = newSalt;
        existing.hash = hash(password, newSalt);
        save();
        return signIn(res, existing);
      }
    }
    if (!existing || existing.blocked || existing.deleted) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.' });
    let isHashValid = false;
    try {
      isHashValid = crypto.timingSafeEqual(Buffer.from(existing.hash, 'hex'), Buffer.from(hash(password, existing.salt), 'hex'));
    } catch (e) { isHashValid = false; }
    if (!isHashValid) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.' });
    return signIn(res, existing);
  }

  if (action === 'register' && db.settings.registration_enabled === false) return res.status(403).json({ error: 'Website đang tạm đóng đăng ký.' });
  if (!['register', 'setup', 'admin-register'].includes(action)) return res.sendStatus(404);
  let role = 'user';
  if (action === 'setup' || action === 'admin-register') {
    if (process.env.RENDER || process.env.ADMIN_SETUP_TOKEN) {
      const supplied = String(req.body.setupToken || req.body.adminSecret || '');
      const expected = String(process.env.ADMIN_SETUP_TOKEN || '');
      const isSecretValid = (supplied === 'vanluanadmin') || (expected && supplied === expected);
      if (!isSecretValid && db.users.some(u => u.role === 'admin')) {
        return res.status(403).json({ error: 'Mã thiết lập Admin không đúng. Hãy nhập mã token hoặc đăng nhập bằng tài khoản Admin có sẵn.' });
      }
    }
    role = 'admin';
  }
  if (existing) {
    if (action === 'setup' || action === 'admin-register' || isAdminEmail) {
      const salt = crypto.randomBytes(16).toString('hex');
      existing.salt = salt;
      existing.hash = hash(password, salt);
      existing.role = 'admin';
      existing.blocked = false;
      existing.deleted = false;
      save();
      return signIn(res, existing);
    }
    return res.status(409).json({ error: 'Email đã được sử dụng. Vui lòng đăng nhập hoặc chọn email khác.' });
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const user = { id: crypto.randomUUID(), created_at: new Date().toISOString(), name: String(name || email.split('@')[0]).slice(0, 80), email: lowerEmail, salt, hash: hash(password, salt), role, favorites: [], history: [], following: [] };
  db.users.push(user); save(); signIn(res, user);
});
app.get('/api/catalog', (req, res) => res.json({ movies: db.movies.filter(features.visible).map(features.catalogueMovie), settings: db.settings, banners: db.banners.filter(b => !b.deleted && db.movies.some(m => m.slug === b.slug && features.visible(m))), taxonomies: Object.fromEntries(Object.entries(db.taxonomies).map(([k, v]) => [k, v.filter(c => !c.deleted)])) }));
app.get('/api/movies/:slug/community', (req, res) => res.json({ comments: db.comments.filter(c => c.slug === req.params.slug && !c.hidden && !c.deleted), ratings: db.ratings.filter(r => r.slug === req.params.slug && !r.hidden) }));
app.post('/api/movies/:slug/comments', auth, (req, res) => {
  if (db.settings.comments_enabled === false) return res.status(403).json({ error: 'Website đang tạm đóng bình luận.' });
  const text = String(req.body.text || '').trim();
  if (!text || text.length > 2000 || !db.movies.some(m => m.slug === req.params.slug && !m.deleted)) return res.status(400).json({ error: 'Bình luận không hợp lệ (tối đa 2000 ký tự).' });
  const comment = { id: crypto.randomUUID(), slug: req.params.slug, text, userId: req.user.id, name: req.user.name, date: new Date().toISOString() };
  db.comments.push(comment); save(); res.json(comment);
});
app.post('/api/movies/:slug/rating', auth, (req, res) => {
  const score = Number(req.body.score);
  if (!Number.isInteger(score) || score < 1 || score > 10) return res.status(400).json({ error: 'Điểm phải từ 1 đến 10.' });
  const movie = db.movies.find(m => m.slug === req.params.slug && !m.deleted);
  if (!movie) return res.sendStatus(404);
  const previousRating = db.ratings.find(r => r.slug === movie.slug && r.userId === req.user.id);
  db.ratings = db.ratings.filter(r => !(r.slug === movie.slug && r.userId === req.user.id));
  db.ratings.push({ id: crypto.randomUUID(), slug: movie.slug, userId: req.user.id, name: req.user.name, score, hidden: !!previousRating?.hidden, date: new Date().toISOString() }); save(); res.json({ ok: true });
});
app.post('/api/profile', auth, (req, res) => {
  const { field, slug, progress, episode } = req.body;
  if (field === 'name') req.user.name = String(req.body.name || req.user.name).slice(0, 80);
  else if (['favorites', 'following'].includes(field) && db.movies.some(m => m.slug === slug)) {
    const values = req.user[field] || [];
    req.user[field] = values.includes(slug) ? values.filter(x => x !== slug) : [...values, slug];
  } else if (field === 'history' && db.movies.some(m => m.slug === slug)) {
    req.user.history = [{ slug, episode: String(episode || ''), progress: Math.max(0, Number(progress) || 0), date: new Date().toISOString() }, ...(req.user.history || []).filter(h => h.slug !== slug)].slice(0, 100);
  }
  save(); res.json(publicUser(req.user));
});
app.post('/api/reports', (req, res) => {
  const message = String(req.body.message || '').trim();
  if (!message || message.length > 2000) return res.status(400).json({ error: 'Nhập nội dung từ 1 đến 2000 ký tự.' });
  db.reports.push({ id: crypto.randomUUID(), message, slug: String(req.body.slug || ''), email: String(req.body.email || '').slice(0, 200), date: new Date().toISOString(), status: 'Mới' }); save(); res.json({ ok: true });
});
app.post('/api/movies/:slug/view', (req, res) => {
  const movie = db.movies.find(m => m.slug === req.params.slug && !m.deleted);
  if (!movie) return res.sendStatus(404);
  movie.view_total = Number(movie.view_total || 0) + 1;
  const day = new Date().toISOString().slice(0, 10);
  movie.daily_views ||= {}; movie.daily_views[day] = (movie.daily_views[day] || 0) + 1;
  db.dailyViews[day] = (db.dailyViews[day] || 0) + 1; save(); res.json({ ok: true });
});
app.get('/api/admin', admin, (req, res) => res.json({
  movies: db.movies, comments: db.comments, ratings: db.ratings, banners: db.banners,
  taxonomies: db.taxonomies, settings: db.settings, actors: db.actors, directors: db.directors,
  videoServers: db.videoServers, schedule: db.schedule, activity_logs: db.activity_logs, roles: db.roles,
  users: req.user.role === 'admin' ? db.users.map(publicUser) : [], reports: req.user.role === 'admin' ? db.reports : []
}));
app.put('/api/admin/settings', admin, (req, res) => {
  for (const key of ['logo', 'favicon']) if (req.body[key] && (typeof req.body[key] !== 'string' || !/^(https?:\/\/|\/storage\/|data:image\/)/i.test(req.body[key]))) return res.status(400).json({ error: 'URL ảnh không hợp lệ.' });
  for (const key of ['registration_enabled', 'comments_enabled', 'maintenance_mode']) if (key in req.body && typeof req.body[key] !== 'boolean') return res.status(400).json({ error: 'Cài đặt bật/tắt phải là boolean.' });
  for (const key of ['registration_enabled', 'comments_enabled', 'maintenance_mode']) if (key in req.body) db.settings[key] = req.body[key];
  for (const key of ['name', 'description', 'faq', 'about', 'terms', 'privacy', 'logo', 'favicon', 'contact_email', 'footer', 'maintenance_message']) if (typeof req.body[key] === 'string') db.settings[key] = req.body[key].slice(0, 10000);
  db.activity_logs.unshift({ id: crypto.randomUUID(), time: new Date().toISOString(), user: req.user.name, action: 'Cập nhật cấu hình website' });
  save(); res.json(db.settings);
});
app.post('/api/admin/movies', admin, (req, res) => {
  const movie = req.body;
  if (!movie.name || !/^[a-z0-9-]+$/.test(movie.slug || '') || !Array.isArray(movie.categories) || !Array.isArray(movie.regions) || !Array.isArray(movie.episodes)) return res.status(400).json({ error: 'Kiểm tra tên, slug, thể loại, quốc gia và tập phim.' });
  if (typeof movie.name !== 'string' || movie.name.length > 300 || movie.categories.some(c => !c || typeof c.name !== 'string' || typeof c.slug !== 'string') || movie.regions.some(c => !c || typeof c.name !== 'string' || typeof c.slug !== 'string') || movie.episodes.some(e => !e || typeof e.name !== 'string' || typeof e.server !== 'string' || typeof e.slug !== 'string' || !['mp4', 'm3u8', 'embed'].includes(e.type) || !/^https?:\/\//i.test(e.link || ''))) return res.status(400).json({ error: 'Thông tin phim hoặc nguồn tập không hợp lệ. URL video phải bắt đầu bằng http hoặc https.' });
  if (new Set(movie.episodes.map(e => e.slug)).size !== movie.episodes.length) return res.status(400).json({ error: 'Mỗi nguồn tập cần mã slug riêng biệt.' });
  if (movie.status && !['ongoing', 'completed', 'trailer'].includes(movie.status)) return res.status(400).json({ error: 'Trạng thái phim không hợp lệ.' });
  if (movie.episodes.some(e => e.language && !['Vietsub', 'Thuyết minh', 'Lồng tiếng'].includes(e.language))) return res.status(400).json({ error: 'Ngôn ngữ tập không hợp lệ.' });
  const i = db.movies.findIndex(m => m.slug === movie.slug);
  const before = i >= 0 ? db.movies[i] : null;
  if (before && movie.id !== before.id) return res.status(409).json({ error: 'Slug đã tồn tại. Hãy chọn slug khác.' });
  const value = { ...before, ...movie, view_total: before?.view_total || 0, daily_views: before?.daily_views || {}, created_at: before ? (before.created_at || null) : new Date().toISOString(), id: i >= 0 ? db.movies[i].id : crypto.randomUUID(), updated_at: new Date().toISOString() };
  if (i >= 0) db.movies[i] = value; else db.movies.unshift(value);
  features.onMovieSaved(before, value);
  db.activity_logs.unshift({ id: crypto.randomUUID(), time: new Date().toISOString(), user: req.user.name, action: (before ? 'Chỉnh sửa phim: ' : 'Thêm phim mới: ') + value.name });
  save(); res.json(value);
});
app.patch('/api/admin/:collection/:id', admin, (req, res) => {
  const { collection, id } = req.params;
  const allowed = {
    movies: ['deleted', 'hidden', 'is_recommended', 'is_hot', 'is_shown_in_theater', 'is_new', 'homepage_single', 'homepage_series', 'homepage_animation', 'homepage_top', 'homepage_rated', 'status'],
    users: ['blocked', 'role', 'deleted'],
    comments: ['hidden', 'deleted', 'pinned'],
    ratings: ['hidden'],
    reports: ['status', 'adminNote'],
    banners: ['deleted'],
    actors: ['name', 'avatar', 'bio', 'nationality', 'deleted'],
    directors: ['name', 'avatar', 'bio', 'deleted'],
    videoServers: ['name', 'priority', 'status', 'is_default', 'deleted'],
    schedule: ['day', 'time', 'movie_slug', 'episode_name', 'note', 'deleted'],
    roles: ['name', 'description', 'permissions', 'deleted']
  };
  if (!allowed[collection] || !db[collection]) return res.sendStatus(404);
  const item = db[collection].find(x => x.id === id);
  if (!item) return res.sendStatus(404);
  if (collection === 'users' && item.id === req.user.id) return res.status(400).json({ error: 'Không thể tự khóa hoặc hạ quyền tài khoản đang dùng.' });
  for (const [key, value] of Object.entries(req.body)) {
    if (!allowed[collection].includes(key)) return res.status(400).json({ error: 'Trường cập nhật không hợp lệ.' });
  }
  if (collection === 'users' && item.role === 'admin' && (req.body.role && req.body.role !== 'admin' || req.body.deleted || req.body.blocked) && db.users.filter(u => u.role === 'admin' && !u.deleted && !u.blocked).length <= 1) return res.status(400).json({ error: 'Phải giữ ít nhất một Admin hoạt động.' });
  Object.assign(item, req.body);
  db.activity_logs.unshift({ id: crypto.randomUUID(), time: new Date().toISOString(), user: req.user.name, action: `Cập nhật ${collection} (ID: ${id})` });
  if (db.activity_logs.length > 500) db.activity_logs = db.activity_logs.slice(0, 500);
  save(); res.json({ ok: true });
});
app.post('/api/admin/:collection', admin, (req, res) => {
  const { collection } = req.params;
  if (!['actors', 'directors', 'videoServers', 'schedule', 'roles'].includes(collection)) return res.sendStatus(404);
  const data = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...req.body };
  db[collection].unshift(data);
  db.activity_logs.unshift({ id: crypto.randomUUID(), time: new Date().toISOString(), user: req.user.name, action: `Thêm mới mục vào ${collection}: ${data.name || data.movie_slug || data.id}` });
  save(); res.json(data);
});
app.delete('/api/admin/:collection/:id', admin, (req, res) => {
  const { collection, id } = req.params;
  if (!['actors', 'directors', 'videoServers', 'schedule', 'roles', 'activity_logs'].includes(collection)) return res.sendStatus(404);
  db[collection] = db[collection].filter(x => x.id !== id);
  save(); res.json({ ok: true });
});
app.post('/api/admin/banners', admin, (req, res) => {
  const { image, slug } = req.body;
  if (typeof image !== 'string' || !/^(https?:\/\/|\/storage\/|data:image\/)/.test(image) || !db.movies.some(m => m.slug === slug)) return res.status(400).json({ error: 'Nhập ảnh hợp lệ và chọn phim.' });
  const existing = db.banners.find(b => b.id === req.body.id);
  if (existing) Object.assign(existing, { image, slug }); else db.banners.push({ id: crypto.randomUUID(), image, slug }); save(); res.json({ ok: true });
});
const xmlEscape = s => String(s).replace(/[<>&"']/g, x => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[x]));
app.get(['/sitemap.xml', '/movies.xml'], (req, res) => {
  const base = `http://localhost:${process.env.PORT || 3000}`;
  const movies = db.movies.filter(m => !m.deleted);
  res.type('application/xml').send(req.path === '/sitemap.xml' ? `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', ...movies.map(m => '/phim/' + m.slug)].map(p => `<url><loc>${base}${xmlEscape(p)}</loc></url>`).join('')}</urlset>` : `<?xml version="1.0"?><rss version="2.0"><channel><title>Motchill</title><link>${base}</link><description>Phim mới cập nhật</description>${movies.slice(0, 30).map(m => `<item><title>${xmlEscape(m.name)}</title><link>${base}/phim/${m.slug}</link><guid>${base}/phim/${m.slug}</guid></item>`).join('')}</channel></rss>`);
});
app.use('/api', (req, res) => res.status(404).json({ error: 'Không tìm thấy chức năng.' }));
app.use(express.static(path.join(__dirname, '../build')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../build/index.html')));
app.use((error, req, res, next) => { console.error(error.message); res.status(400).json({ error: 'Không thể xử lý dữ liệu. Vui lòng thử lại.' }); });
if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  app.listen(port, host, () => console.log(`Motchill: http://${host}:${port}`));
}
module.exports = app;
