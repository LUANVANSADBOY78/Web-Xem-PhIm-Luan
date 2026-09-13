const crypto = require('crypto');
const navigation = require('../src/navigation.json');
const slugify = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

module.exports = function features(app, db, save, auth, admin) {
  db.notifications ||= [];
  db.dailyViews ||= {};
  db.taxonomies ||= {};
  for (const [kind, title] of [['categories', 'Thể Loại'], ['regions', 'Quốc Gia']]) {
    if (!db.taxonomies[kind]) db.taxonomies[kind] = [...new Map([
      ...(navigation[title] || []).map(l => ({ name: l.name, slug: l.href.split('/').pop() })),
      ...db.movies.flatMap(m => m[kind] || []),
    ].map(c => [c.slug, { ...c, id: c.slug }])).values()];
  }
  const visible = m => !m.deleted && !m.hidden;
  function catalogueMovie(m) {
    const ratings = db.ratings.filter(r => r.slug === m.slug && !r.hidden);
    const within = days => Object.entries(m.daily_views || {}).filter(([date]) => Date.now() - new Date(date).getTime() < days * 86400000).reduce((sum, [, count]) => sum + count, 0);
    return { ...m, view_week: Number(m.view_week || 0) + within(7), view_month: Number(m.view_month || 0) + within(30),
      rating_star: ratings.length ? (ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1) : m.rating_star,
      reference_rating: m.rating_star, local_rating_count: ratings.length,
      comment_count: db.comments.filter(c => c.slug === m.slug && !c.hidden && !c.deleted).length,
      ...Object.fromEntries(['categories', 'regions'].map(kind => [kind, (m[kind] || []).filter(c => !db.taxonomies[kind].find(t => t.slug === c.slug)?.deleted)])),
    };
  }
  function onMovieSaved(before, after) {
    for (const kind of ['categories', 'regions']) for (const c of after[kind]) {
      if (!db.taxonomies[kind].some(t => t.slug === c.slug)) db.taxonomies[kind].push({ ...c, id: c.slug });
    }
    if (!visible(after)) return;
    const oldIds = new Set((before?.episodes || []).map(e => String(e.id || e.slug)));
    const newEpisodes = after.episodes.filter(e => !oldIds.has(String(e.id || e.slug)));
    if (before && !newEpisodes.length) return;
    for (const u of db.users.filter(u => !u.deleted && !u.blocked)) {
      const prefs = u.notificationPreferences || {};
      if ((!before && prefs.newMovies !== false) || (before && prefs.newEpisodes !== false && u.following?.includes(after.slug))) {
        db.notifications.push({ id: crypto.randomUUID(), userId: u.id, slug: after.slug,
          title: before ? `${after.name}: có ${newEpisodes.length} nguồn tập mới` : `Phim mới: ${after.name}`,
          episode: newEpisodes[0]?.slug, date: new Date().toISOString(), read: false });
      }
    }
  }
  app.get('/api/notifications', auth, (req, res) => res.json(db.notifications.filter(n => n.userId === req.user.id && db.movies.some(m => m.slug === n.slug && visible(m))).slice().reverse()));
  app.post('/api/notifications/read', auth, (req, res) => {
    db.notifications.filter(n => n.userId === req.user.id && (!req.body.id || n.id === req.body.id)).forEach(n => { n.read = true; });
    save(); res.json({ ok: true });
  });
  app.put('/api/notifications/preferences', auth, (req, res) => {
    req.user.notificationPreferences = { newMovies: req.body.newMovies !== false, newEpisodes: req.body.newEpisodes !== false };
    save(); res.json(req.user.notificationPreferences);
  });
  app.post('/api/comments/:id/like', auth, (req, res) => {
    const c = db.comments.find(c => c.id === req.params.id && !c.hidden && !c.deleted);
    if (!c) return res.status(404).json({ error: 'Không tìm thấy bình luận.' });
    const likes = c.likes || [];
    c.likes = likes.includes(req.user.id) ? likes.filter(id => id !== req.user.id) : [...likes, req.user.id];
    save(); res.json({ count: c.likes.length });
  });
  app.post('/api/admin/taxonomies/:kind', admin, (req, res) => {
    const { kind } = req.params;
    if (!['categories', 'regions'].includes(kind)) return res.status(404).json({ error: 'Phân loại không hợp lệ.' });
    const name = String(req.body.name || '').trim().slice(0, 80);
    const slug = slugify(name);
    if (!slug) return res.status(400).json({ error: 'Nhập tên phân loại.' });
    const entries = db.taxonomies[kind];
    const old = entries.find(c => c.id === req.body.id);
    if (entries.some(c => c.slug === slug && c.id !== old?.id)) return res.status(409).json({ error: 'Tên phân loại đã tồn tại.' });
    if (old) {
      const oldSlug = old.slug;
      Object.assign(old, { name, slug, deleted: !!req.body.deleted });
      for (const m of db.movies) m[kind] = m[kind].map(c => c.slug === oldSlug ? { ...c, name, slug } : c);
    } else entries.push({ id: crypto.randomUUID(), name, slug, deleted: false });
    save(); res.json(entries);
  });
  app.get('/api/admin/statistics', admin, (req, res) => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(); d.setUTCDate(d.getUTCDate() - 29 + i);
      const date = d.toISOString().slice(0, 10);
      return { date, views: db.dailyViews[date] || 0 };
    });
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 11 + i, 1)).toISOString().slice(0, 7);
      return { date, views: Object.entries(db.dailyViews).filter(([d]) => d.startsWith(date)).reduce((s, [, v]) => s + Number(v), 0) };
    });
    const movies = db.movies.filter(m => !m.deleted);
    const ratings = m => db.ratings.filter(r => r.slug === m.slug && !r.hidden);
    res.json({ days, months, timezone: 'UTC', totals: {
      movies: movies.length, episodes: movies.reduce((s, m) => s + new Set(m.episodes.map(e => e.name.trim().toLowerCase().replace(/^tập\s*/, '').replace(/^0+(?=\d)/, ''))).size, 0),
      users: db.users.filter(u => !u.deleted).length, comments: db.comments.filter(c => !c.deleted).length,
      views: movies.reduce((s, m) => s + Number(m.view_total || 0), 0),
      today: db.dailyViews[today] || 0, week: days.slice(-7).reduce((s, d) => s + d.views, 0), month: months.at(-1).views,
      newUsers: db.users.filter(u => !u.deleted && u.created_at?.startsWith(month)).length,
      newComments: db.comments.filter(c => !c.deleted && c.date?.startsWith(month)).length
    }, newest: movies.filter(m => m.created_at).sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0,8).map(m => ({ id:m.id, name:m.name, slug:m.slug, created_at:m.created_at })),
    top: [...movies].sort((a,b) => Number(b.view_total || 0)-Number(a.view_total || 0)).slice(0,10).map(m => ({ id:m.id, name:m.name, slug:m.slug, views:Number(m.view_total || 0) })),
    rated: movies.map(m => { const r = ratings(m); return { id:m.id, name:m.name, slug:m.slug, count:r.length, score:r.length ? r.reduce((s,r)=>s+r.score,0)/r.length : 0 }; }).filter(m=>m.count).sort((a,b)=>b.score-a.score).slice(0,10)
    });
  });
  return { catalogueMovie, onMovieSaved, visible };
};
