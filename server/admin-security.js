const crypto = require('crypto');

const resources = ['movie', 'episode', 'category', 'country', 'actor', 'director', 'video-server', 'trending', 'homepage', 'banner', 'schedule', 'notification', 'ad', 'post', 'page', 'language', 'user', 'comment', 'rating', 'report', 'role'];
const PERMISSIONS = [...resources.flatMap(resource => ['view', 'create', 'update', 'delete'].map(action => `${resource}.${action}`)), 'dashboard.view', 'analytics.view', 'setting.view', 'setting.update', 'seo.view', 'seo.update', 'backup.view', 'backup.create', 'backup.restore', 'backup.delete', 'import.create', 'export.view', 'system.manage', 'security.view', 'security.manage', 'activity.view', 'api.view', 'api.manage', 'watch-history.view', 'favorite.view'];
const contentPermissions = PERMISSIONS.filter(p => ['movie', 'episode', 'category', 'country', 'actor', 'director', 'video-server', 'trending', 'homepage', 'banner', 'schedule', 'post', 'page', 'comment', 'rating', 'report'].includes(p.split('.')[0])).concat('dashboard.view', 'analytics.view');
const defaults = [
  { id: 'admin', name: 'Super Admin', permissions: ['*'], builtIn: true },
  { id: 'staff', name: 'Nhân viên nội dung', permissions: contentPermissions, builtIn: true },
  { id: 'content-admin', name: 'Content Admin', permissions: contentPermissions, builtIn: true },
  { id: 'moderator', name: 'Moderator', permissions: PERMISSIONS.filter(p => /^(comment|rating|report)\./.test(p)).concat('dashboard.view'), builtIn: true },
  { id: 'editor', name: 'Editor', permissions: PERMISSIONS.filter(p => /^(movie|episode)\.(view|create|update)$/.test(p)).concat('dashboard.view', 'category.view', 'country.view'), builtIn: true },
  { id: 'user', name: 'Người dùng', permissions: [], builtIn: true },
];
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const passwordHash = (password, salt) => crypto.scryptSync(password, salt, 64).toString('hex');
const safePassword = (user, password) => {
  if (!user?.salt || typeof password !== 'string' || password.length > 200 || !/^[0-9a-f]{128}$/i.test(user.hash || '')) return false;
  return crypto.timingSafeEqual(Buffer.from(user.hash, 'hex'), Buffer.from(passwordHash(password, user.salt), 'hex'));
};
const validPassword = password => typeof password === 'string' && password.length >= 8 && password.length <= 200;

module.exports = (app, db, save, { sessions, auth }) => {
  db.roles ||= [];
  db.login_logs ||= [];
  db.activity_logs ||= [];
  db.recovery_tokens ||= [];
  db.api_keys ||= [];
  for (const role of defaults) if (!db.roles.some(r => r.id === role.id)) db.roles.push({ ...role });
  const rolesFor = user => db.roles.find(r => r.id === String(user?.role || '').toLowerCase());
  const permissionsFor = user => !user || user.blocked || user.deleted ? [] : String(user.role).toLowerCase() === 'admin' ? ['*'] : (rolesFor(user)?.permissions || []).filter(p => PERMISSIONS.includes(p));
  const hasPermission = (user, permission) => {
    const permissions = permissionsFor(user);
    return permissions.includes('*') || permissions.includes(permission);
  };
  const requirePermission = permission => (req, res, next) => hasPermission(req.user, permission) ? next() : res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.', permission });
  const publicUser = user => {
    const { id, name, email, role, created_at, blocked, deleted = false, favorites = [], history = [], following = [], last_login, email_verified = false, notificationPreferences = { newMovies: true, newEpisodes: true } } = user;
    const permissions = permissionsFor(user);
    return { id, name, email, role, created_at, blocked, deleted, favorites, history, following, last_login, email_verified, notificationPreferences, permissions, isAdmin: permissions.length > 0 };
  };
  const revokeUser = (id, except) => { for (const [token, session] of sessions) if (session.id === id && token !== except) sessions.delete(token); };
  const loginAudit = (req, user, result, action = 'login') => {
    db.login_logs.unshift({ id: crypto.randomUUID(), userId: user?.id || null, name: user?.name || 'Không xác định', action, result, date: new Date().toISOString(), device: String(req.headers['user-agent'] || '').slice(0, 180) });
    db.login_logs = db.login_logs.slice(0, 2000);
    save();
  };
  const buckets = new Map();
  const usage = new Map();
  function consume(key, limit) {
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.time >= 60000) bucket = { count: 0, time: now };
    buckets.set(key, bucket);
    if (buckets.size > 10000) for (const [id, entry] of buckets) if (now - entry.time >= 60000) buckets.delete(id);
    return ++bucket.count <= limit;
  }
  app.use('/api', (req, res, next) => {
    const began = Date.now();
    res.on('finish', () => {
      const route = `${req.method} ${req.route?.path || '/api/unknown'}`;
      const entry = usage.get(route) || { endpoint: route, requests: 0, errors: 0, totalMs: 0, lastStatus: 0 };
      entry.requests++; entry.errors += res.statusCode >= 400 ? 1 : 0; entry.totalMs += Date.now() - began; entry.lastStatus = res.statusCode; entry.lastRequest = new Date().toISOString();
      if (usage.size < 500 || usage.has(route)) usage.set(route, entry);
      if (req.originalUrl.startsWith('/api/admin') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        db.activity_logs.unshift({ id: crypto.randomUUID(), userId: req.user?.id || null, name: req.user?.name || 'Không xác định', action: `${req.method} ${req.route?.path || '/api/admin/unknown'}`, target: String(req.params?.id || req.params?.collection || '').slice(0, 100), date: new Date().toISOString(), result: res.statusCode < 400 ? 'success' : 'denied', status: res.statusCode });
        db.activity_logs = db.activity_logs.slice(0, 5000);
        save();
      }
    });
    const limit = Math.max(30, Math.min(10000, Number(db.settings.api_rate_limit) || 300));
    if (!consume(`ip:${req.ip}`, limit)) { res.set('Retry-After', '60'); return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau một phút.' }); }
    const supplied = req.get('x-api-key');
    if (supplied) {
      const key = db.api_keys.find(k => !k.revoked && k.hash === digest(supplied));
      if (!key) return res.status(401).json({ error: 'API key không hợp lệ.' });
      if (!['GET', 'HEAD'].includes(req.method) || !/^\/api\/(catalog|health|content)(\/|$|\?)/.test(req.originalUrl)) return res.status(403).json({ error: 'API key chỉ được đọc danh mục công khai.' });
      if (!consume(`api:${key.id}`, key.rateLimit)) { res.set('Retry-After', '60'); return res.status(429).json({ error: 'API key vượt giới hạn mỗi phút.' }); }
      key.requests = (key.requests || 0) + 1; key.lastUsed = new Date().toISOString();
    }
    next();
  });
  app.get('/api/admin/permissions', requirePermission('role.view'), (req, res) => res.json({ permissions: PERMISSIONS }));
  app.get('/api/admin/roles', requirePermission('role.view'), (req, res) => res.json(db.roles.map(r => ({ ...r, users: db.users.filter(u => u.role === r.id && !u.deleted).length }))));
  function roleBody(req, res, current) {
    const id = current?.id || String(req.body.id || '').toLowerCase();
    if (!/^[a-z][a-z0-9-]{1,49}$/.test(id) || typeof req.body.name !== 'string' || !req.body.name.trim() || !Array.isArray(req.body.permissions) || req.body.permissions.some(p => !PERMISSIONS.includes(p))) { res.status(400).json({ error: 'Nhập mã vai trò, tên và danh sách quyền hợp lệ.' }); return null; }
    if (['admin', 'user'].includes(id)) { res.status(400).json({ error: 'Không thể thay đổi vai trò Super Admin hoặc User.' }); return null; }
    return { id, name: req.body.name.trim().slice(0, 80), permissions: [...new Set(req.body.permissions)], builtIn: !!current?.builtIn };
  }
  app.post('/api/admin/roles', requirePermission('role.create'), (req, res) => {
    const value = roleBody(req, res); if (!value) return;
    if (db.roles.some(r => r.id === value.id)) return res.status(409).json({ error: 'Mã vai trò đã tồn tại.' });
    db.roles.push(value); save(); res.status(201).json(value);
  });
  app.put('/api/admin/roles/:id', requirePermission('role.update'), (req, res) => {
    const i = db.roles.findIndex(r => r.id === req.params.id); if (i < 0) return res.sendStatus(404);
    const value = roleBody(req, res, db.roles[i]); if (!value) return;
    db.roles[i] = value; save(); res.json(value);
  });
  app.delete('/api/admin/roles/:id', requirePermission('role.delete'), (req, res) => {
    const role = db.roles.find(r => r.id === req.params.id); if (!role) return res.sendStatus(404);
    if (role.builtIn || db.users.some(u => u.role === role.id)) return res.status(409).json({ error: 'Không thể xóa vai trò mặc định hoặc đang có người dùng.' });
    db.roles = db.roles.filter(r => r.id !== role.id); save(); res.json({ ok: true });
  });
  app.get('/api/admin/security', auth, (req, res) => {
    if (!permissionsFor(req.user).length) return res.status(403).json({ error: 'Chỉ dành cho tài khoản quản trị.' });
    const all = hasPermission(req.user, 'security.view');
    res.json({ sessions: [...sessions.entries()].filter(([, s]) => s.expires > Date.now() && (all || s.id === req.user.id)).map(([token, s]) => ({ id: s.sid, userId: s.id, name: db.users.find(u => u.id === s.id)?.name, createdAt: s.createdAt, expiresAt: new Date(s.expires).toISOString(), device: s.device, current: token === req.token })), loginLogs: db.login_logs.filter(l => all || l.userId === req.user.id).slice(0, 200), emailDelivery: 'manual-admin', twoFactorEnabled: false });
  });
  app.delete('/api/admin/security/sessions/:id', auth, (req, res) => {
    const found = [...sessions.entries()].find(([, s]) => s.sid === req.params.id);
    if (!found) return res.status(404).json({ error: 'Không tìm thấy phiên đăng nhập.' });
    if (found[1].id !== req.user.id && !hasPermission(req.user, 'security.manage')) return res.status(403).json({ error: 'Bạn chỉ được đăng xuất phiên của mình.' });
    sessions.delete(found[0]); res.json({ ok: true });
  });
  app.post('/api/admin/security/change-password', auth, (req, res) => {
    if (!consume(`password:${req.user.id}`, 10)) return res.status(429).json({ error: 'Vui lòng thử lại sau một phút.' });
    if (!safePassword(req.user, req.body.currentPassword) || !validPassword(req.body.newPassword)) return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng hoặc mật khẩu mới phải dài 8–200 ký tự.' });
    req.user.salt = crypto.randomBytes(16).toString('hex'); req.user.hash = passwordHash(req.body.newPassword, req.user.salt);
    revokeUser(req.user.id, req.token); db.recovery_tokens = db.recovery_tokens.filter(t => t.userId !== req.user.id); save(); loginAudit(req, req.user, 'success', 'password-change'); res.json({ ok: true });
  });
  app.post('/api/admin/security/recovery', requirePermission('security.manage'), (req, res) => {
    const user = db.users.find(u => u.id === req.body.userId && !u.deleted && !u.blocked);
    if (!user || !['reset', 'verify'].includes(req.body.purpose)) return res.status(400).json({ error: 'Chọn tài khoản và mục đích reset/verify hợp lệ.' });
    const token = crypto.randomBytes(32).toString('hex');
    db.recovery_tokens = db.recovery_tokens.filter(t => t.expires > Date.now() && !(t.userId === user.id && t.purpose === req.body.purpose));
    db.recovery_tokens.push({ hash: digest(token), userId: user.id, purpose: req.body.purpose, expires: Date.now() + 1800000 }); save();
    res.json({ token, expiresIn: 1800, purpose: req.body.purpose, delivery: 'manual-admin', message: 'Mã chỉ hiển thị một lần. Quản trị viên xác minh chủ tài khoản và chuyển mã qua kênh riêng.' });
  });
  app.post('/api/auth/forgot-password', (req, res) => {
    if (!consume(`recovery:${req.ip}`, 5)) return res.status(429).json({ error: 'Vui lòng thử lại sau một phút.' });
    res.json({ ok: true, delivery: 'manual-admin', message: 'Liên hệ quản trị viên để xác minh tài khoản và nhận mã khôi phục. Hệ thống chưa cấu hình gửi email tự động.' });
  });
  function tokenFor(req, purpose) {
    if (typeof req.body.token !== 'string' || req.body.token.length !== 64) return null;
    return db.recovery_tokens.find(t => t.hash === digest(req.body.token) && t.purpose === purpose && t.expires > Date.now());
  }
  app.post('/api/auth/reset-password', (req, res) => {
    if (!consume(`reset:${req.ip}`, 10)) return res.status(429).json({ error: 'Vui lòng thử lại sau một phút.' });
    const record = tokenFor(req, 'reset'); const user = record && db.users.find(u => u.id === record.userId && !u.deleted && !u.blocked);
    if (!user || !validPassword(req.body.password)) return res.status(400).json({ error: 'Mã không hợp lệ/hết hạn hoặc mật khẩu phải dài 8–200 ký tự.' });
    user.salt = crypto.randomBytes(16).toString('hex'); user.hash = passwordHash(req.body.password, user.salt);
    db.recovery_tokens = db.recovery_tokens.filter(t => t.userId !== user.id); revokeUser(user.id); save(); loginAudit(req, user, 'success', 'password-reset'); res.json({ ok: true });
  });
  app.post('/api/auth/verify', (req, res) => {
    if (!consume(`verify:${req.ip}`, 10)) return res.status(429).json({ error: 'Vui lòng thử lại sau một phút.' });
    const record = tokenFor(req, 'verify'); const user = record && db.users.find(u => u.id === record.userId && !u.deleted && !u.blocked);
    if (!user) return res.status(400).json({ error: 'Mã xác thực không hợp lệ hoặc đã hết hạn.' });
    user.email_verified = true; db.recovery_tokens = db.recovery_tokens.filter(t => t !== record); save(); res.json({ ok: true });
  });
  app.get('/api/admin/activity-logs', requirePermission('activity.view'), (req, res) => {
    const q = String(req.query.q || '').toLowerCase();
    res.json(db.activity_logs.filter(l => !q || [l.name, l.action, l.target].some(v => String(v || '').toLowerCase().includes(q))).slice(0, 500));
  });
  const safeKey = ({ hash, ...key }) => key;
  app.get('/api/admin/api-management', requirePermission('api.view'), (req, res) => res.json({ status: 'ok', keys: db.api_keys.map(safeKey), usage: [...usage.values()].map(u => ({ ...u, averageMs: Math.round(u.totalMs / u.requests) })), rateLimit: Number(db.settings.api_rate_limit) || 300, windowSeconds: 60, scope: 'catalog.read', note: 'Thống kê yêu cầu từ lần khởi động server; khóa chỉ đọc danh mục công khai.' }));
  app.put('/api/admin/api-management', requirePermission('api.manage'), (req, res) => {
    const limit = Number(req.body.rateLimit); if (!Number.isInteger(limit) || limit < 30 || limit > 10000) return res.status(400).json({ error: 'Giới hạn phải từ 30 đến 10000 yêu cầu/phút.' });
    db.settings.api_rate_limit = limit; save(); res.json({ rateLimit: limit });
  });
  app.post('/api/admin/api-keys', requirePermission('api.manage'), (req, res) => {
    if (typeof req.body.name !== 'string' || !req.body.name.trim()) return res.status(400).json({ error: 'Nhập tên API key.' });
    const rateLimit = Number(req.body.rateLimit || 60); if (!Number.isInteger(rateLimit) || rateLimit < 1 || rateLimit > 1000) return res.status(400).json({ error: 'Giới hạn khóa phải từ 1–1000 yêu cầu/phút.' });
    const token = 'movie_' + crypto.randomBytes(32).toString('hex');
    const key = { id: crypto.randomUUID(), name: req.body.name.trim().slice(0, 80), hash: digest(token), prefix: token.slice(0, 12), scope: 'catalog.read', rateLimit, requests: 0, createdAt: new Date().toISOString(), revoked: false };
    db.api_keys.push(key); save(); res.status(201).json({ ...safeKey(key), token });
  });
  app.delete('/api/admin/api-keys/:id', requirePermission('api.manage'), (req, res) => {
    const key = db.api_keys.find(k => k.id === req.params.id); if (!key) return res.status(404).json({ error: 'Không tìm thấy API key.' });
    key.revoked = true; save(); res.json({ ok: true });
  });
  return { permissionsFor, hasPermission, requirePermission, publicUser, loginAudit, revokeUser, safePassword, permissions: PERMISSIONS };
};
