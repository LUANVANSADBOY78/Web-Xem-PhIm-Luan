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
  settings: { name: 'Văn Luân', description: 'Xem phim Vietsub, thuyết minh và lồng tiếng chất lượng cao.', faq: 'Chọn phim, bấm Xem phim rồi chọn máy chủ và tập muốn xem. Nếu video không phát, hãy đổi máy chủ hoặc gửi báo lỗi.' },
};
function save() { fs.writeFileSync(file + '.tmp', JSON.stringify(db)); fs.renameSync(file + '.tmp', file); }
if (db.settings?.name === 'Motchill') { db.settings.name = 'Văn Luân'; save(); }
const sessions = new Map();
const attempts = new Map();
const publicUser = ({ id, name, email, role, blocked, favorites = [], history = [], following = [], deleted = false, notificationPreferences = { newMovies: true, newEpisodes: true } }) => ({ id, name, email, role, blocked, favorites, history, following, deleted, notificationPreferences });
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
const admin = (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'Chỉ quản trị viên được thực hiện thao tác này.' });
const features = require('./features')(app, db, save, auth, admin);
function signIn(res, user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { id: user.id, expires: Date.now() + 86400000 });
  res.cookie('session', token, { httpOnly: true, secure: !!process.env.RENDER, sameSite: 'strict', maxAge: 86400000 });
  res.json(publicUser(user));
}
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/session', (req, res) => res.json({ user: req.user ? publicUser(req.user) : null, needsSetup: !db.users.some(u => u.role === 'admin'), setupRequiresToken: !!(process.env.ADMIN_SETUP_TOKEN || process.env.RENDER) }));
app.post('/api/auth/:action', (req, res) => {
  const { action } = req.params;
  if (action === 'logout') { sessions.delete(req.token); res.clearCookie('session'); return res.json({ ok: true }); }
  const { email, password, name } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email.includes('@') || password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Nhập email hợp lệ và mật khẩu từ 8 đến 200 ký tự.' });
  const key = req.ip;
  const counter = attempts.get(key) || { count: 0, time: Date.now() };
  if (Date.now() - counter.time > 60000) { counter.count = 0; counter.time = Date.now(); }
  attempts.set(key, counter);
  if (++counter.count > 20) return res.status(429).json({ error: 'Vui lòng thử lại sau một phút.' });
  const existing = db.users.find(u => u.email === email.toLowerCase());
  if (action === 'login') {
    if (!existing || existing.blocked || existing.deleted || !crypto.timingSafeEqual(Buffer.from(existing.hash, 'hex'), Buffer.from(hash(password, existing.salt), 'hex'))) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.' });
    return signIn(res, existing);
  }
  if (!['register', 'setup'].includes(action)) return res.sendStatus(404);
  if (action === 'setup' && (process.env.RENDER || process.env.ADMIN_SETUP_TOKEN)) {
    const supplied = Buffer.from(String(req.body.setupToken || ''));
    const expected = Buffer.from(process.env.ADMIN_SETUP_TOKEN || '');
    if (!expected.length || supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return res.status(403).json({ error: 'Mã thiết lập Admin không đúng. Lấy mã ADMIN_SETUP_TOKEN trong Environment của dịch vụ Render.' });
  }
  if (action === 'setup' && db.users.some(u => u.role === 'admin')) return res.status(403).json({ error: 'Quản trị viên đã được thiết lập.' });
  if (existing) return res.status(409).json({ error: 'Email đã được sử dụng.' });
  const salt = crypto.randomBytes(16).toString('hex');
  const user = { id: crypto.randomUUID(), name: String(name || email.split('@')[0]).slice(0, 80), email: email.toLowerCase(), salt, hash: hash(password, salt), role: action === 'setup' ? 'admin' : 'user', favorites: [], history: [], following: [] };
  db.users.push(user); save(); signIn(res, user);
});
app.get('/api/catalog', (req, res) => res.json({ movies: db.movies.filter(features.visible).map(features.catalogueMovie), settings: db.settings, banners: db.banners.filter(b => !b.deleted && db.movies.some(m => m.slug === b.slug && features.visible(m))), taxonomies: Object.fromEntries(Object.entries(db.taxonomies).map(([k, v]) => [k, v.filter(c => !c.deleted)])) }));
app.get('/api/movies/:slug/community', (req, res) => res.json({ comments: db.comments.filter(c => c.slug === req.params.slug && !c.hidden && !c.deleted), ratings: db.ratings.filter(r => r.slug === req.params.slug && !r.hidden) }));
app.post('/api/movies/:slug/comments', auth, (req, res) => {
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
app.get('/api/admin', admin, (req, res) => res.json({ ...db, users: db.users.map(publicUser) }));
app.put('/api/admin/settings', admin, (req, res) => {
  for (const key of ['name', 'description', 'faq', 'about', 'terms', 'privacy']) if (typeof req.body[key] === 'string') db.settings[key] = req.body[key].slice(0, 10000);
  save(); res.json(db.settings);
});
app.post('/api/admin/movies', admin, (req, res) => {
  const movie = req.body;
  if (!movie.name || !/^[a-z0-9-]+$/.test(movie.slug || '') || !Array.isArray(movie.categories) || !Array.isArray(movie.regions) || !Array.isArray(movie.episodes)) return res.status(400).json({ error: 'Kiểm tra tên, slug, thể loại, quốc gia và tập phim.' });
  if (typeof movie.name !== 'string' || movie.name.length > 300 || movie.categories.some(c => !c || typeof c.name !== 'string' || typeof c.slug !== 'string') || movie.regions.some(c => !c || typeof c.name !== 'string' || typeof c.slug !== 'string') || movie.episodes.some(e => !e || typeof e.name !== 'string' || typeof e.server !== 'string' || typeof e.slug !== 'string' || !['mp4', 'm3u8', 'embed'].includes(e.type) || !/^https?:\/\//i.test(e.link || ''))) return res.status(400).json({ error: 'Thông tin phim hoặc nguồn tập không hợp lệ. URL video phải bắt đầu bằng http hoặc https.' });
  if (new Set(movie.episodes.map(e => e.slug)).size !== movie.episodes.length) return res.status(400).json({ error: 'Mỗi nguồn tập cần mã slug riêng biệt.' });
  const i = db.movies.findIndex(m => m.slug === movie.slug);
  const before = i >= 0 ? db.movies[i] : null;
  const value = { ...movie, id: i >= 0 ? db.movies[i].id : crypto.randomUUID(), updated_at: new Date().toISOString() };
  if (i >= 0) db.movies[i] = value; else db.movies.unshift(value);
  features.onMovieSaved(before, value);
  save(); res.json(value);
});
app.patch('/api/admin/:collection/:id', admin, (req, res) => {
  const { collection, id } = req.params;
  const allowed = { movies: ['deleted', 'hidden'], users: ['blocked', 'role', 'deleted'], comments: ['hidden', 'deleted', 'pinned'], ratings: ['hidden'], reports: ['status', 'adminNote'], banners: ['deleted'] };
  if (!allowed[collection]) return res.sendStatus(404);
  const item = db[collection].find(x => x.id === id);
  if (!item) return res.sendStatus(404);
  if (collection === 'users' && item.id === req.user.id) return res.status(400).json({ error: 'Không thể tự khóa hoặc hạ quyền tài khoản đang dùng.' });
  for (const key of allowed[collection]) if (key in req.body) {
    if (key === 'role' && !['admin', 'user'].includes(req.body[key])) continue;
    item[key] = req.body[key];
  }
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
