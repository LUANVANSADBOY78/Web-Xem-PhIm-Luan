import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { Link, Route, Switch, useLocation, useHistory, useParams } from 'react-router-dom';
import Hls from 'hls.js';
import { api, normalize, number } from './api';
import navigation from './navigation.json';
import { isAnimation, matchesType, searchable, episodeOrder, subtitleTracks, recommend, extraTopics } from './discovery';
import Notifications, { NotificationBell } from './Notifications';
import Admin from './Admin';
import { ChatBot, RatingPeople } from './SupportWidgets';

export const Context = createContext();
const useApp = () => useContext(Context);
const movieUrl = m => '/phim/' + m.slug;
const safeMedia = url => /^(https?:\/\/|\/storage\/|data:image\/)/i.test(url || '') ? url : '';
function Poster({ movie, wide = false, ...props }) {
  return <img src={safeMedia(wide ? movie.poster_url : movie.thumb_url) || '/poster-fallback.svg'} alt={movie.name} loading="lazy" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/poster-fallback.svg'; }} {...props} />;
}
export function Card({ movie, wide = false, featured = false }) {
  return <Link className={`movie-card ${wide ? 'wide-card' : ''} ${featured ? 'featured' : ''}`} to={movieUrl(movie)} title={movie.name}>
    <div className="poster"><Poster movie={movie} wide={wide} /><span className="language">{movie.language || 'Vietsub'}</span><span className="quality">{movie.quality || 'HD'}</span><span className="episode-badge">{movie.type !== 'single' ? movie.episode_current : ''}</span><span className="play-icon">▷</span>{wide && <div className="overlay-title"><h3>{movie.name}</h3>{featured && <p>{movie.origin_name}</p>}</div>}</div>
    {!wide && <div className="card-caption"><h3>{movie.name}</h3><p>{movie.origin_name}</p><small className="card-stats">★ {movie.rating_star || '—'} · ◉ {number(movie.view_total)}</small><small className="card-status">{movie.status === 'completed' ? 'Hoàn tất' : movie.status === 'trailer' ? 'Trailer' : 'Đang chiếu'}</small></div>}
  </Link>;
}
function Header() {
  const { user, settings, movies, taxonomies, theme, setTheme } = useApp();
  const history = useHistory();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState('');
  const [mobile, setMobile] = useState(false);
  const [suggest, setSuggest] = useState(false);

  const menus = {
    'Thể Loại': taxonomies?.categories?.map(c => ({ name: c.name, href: '/the-loai/' + c.slug })) || navigation['Thể Loại'],
    'Quốc Gia': taxonomies?.regions?.map(c => ({ name: c.name, href: '/quoc-gia/' + c.slug })) || navigation['Quốc Gia'],
    'Năm': navigation['Năm Phát Hành'] || [],
    'Bảng Xếp Hạng': [
      { name: '🔥 Phim Hot Tuần', href: '/danh-sach/phim-hot-tuan' },
      { name: '⭐ Đánh Giá Cao', href: '/danh-sach/danh-gia-cao' },
      { name: '💬 Top Bình Luận', href: '/danh-sach/top-binh-luan' },
      { name: '🎬 Phim Chiếu Rạp', href: '/danh-sach/phim-chieu-rap' }
    ]
  };

  const suggestions = query.trim() ? movies.filter(m => searchable(m).includes(normalize(query.trim()))).slice(0, 6) : [];
  useEffect(() => { setOpen(''); setMobile(false); setSuggest(false); }, [location.pathname, location.search]);

  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label={settings.name}>
        {settings.logo ? <img src={safeMedia(settings.logo)} alt="" style={{ maxWidth: 48, maxHeight: 40, marginRight: 8 }} /> : <span style={{ background: '#f98a27', color: '#000', padding: '4px 8px', borderRadius: '4px', fontWeight: '900', marginRight: '6px' }}>▶</span>}
        <span className="brand-name" style={{ color: '#fff', fontWeight: '800', letterSpacing: '0.5px' }}>{settings.name}</span>
      </Link>
      <button className="mobile-toggle" onClick={() => setMobile(!mobile)} aria-label="Mở menu" aria-expanded={mobile}>☰</button>
      
      <nav className={mobile ? 'nav open' : 'nav'}>
        <Link to="/" style={{ color: location.pathname === '/' ? '#f98a27' : 'inherit', fontWeight: location.pathname === '/' ? 'bold' : 'normal' }}>Trang Chủ</Link>
        <Link to="/danh-sach/phim-le">Phim Lẻ</Link>
        <Link to="/danh-sach/phim-bo">Phim Bộ</Link>
        <Link to="/danh-sach/phim-chieu-rap">Chiếu Rạp</Link>
        <Link to="/the-loai/hoat-hinh">Anime</Link>
        {Object.entries(menus).map(([title, links]) => (
          <div className="nav-group" key={title} onMouseEnter={() => setOpen(title)} onMouseLeave={() => setOpen('')}>
            <button aria-expanded={open === title} onClick={() => setOpen(open === title ? '' : title)}>
              {title} <span>⌄</span>
            </button>
            {open === title && (
              <div className="dropdown">
                {links.map(l => <Link key={l.href} to={l.href}>{l.name}</Link>)}
              </div>
            )}
          </div>
        ))}
      </nav>

      <form className="search" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setSuggest(false); }} onSubmit={e => { e.preventDefault(); history.push('/tim-kiem?q=' + encodeURIComponent(query.trim())); }}>
        <input onFocus={() => setSuggest(true)} onKeyDown={e => e.key === 'Escape' && setSuggest(false)} aria-label="Tìm kiếm phim" placeholder="Tìm tên phim, diễn viên..." value={query} onChange={e => setQuery(e.target.value)} />
        <button aria-label="Tìm kiếm">⌕</button>
        {suggest && suggestions.length > 0 && (
          <div className="search-suggestions">
            {suggestions.map(m => (
              <Link key={m.slug} to={movieUrl(m)} onClick={() => setSuggest(false)}>
                <Poster movie={m} />
                <div>
                  <span style={{ fontWeight: 'bold' }}>{m.name}</span>
                  <small style={{ color: '#a9b6ca' }}>{m.origin_name} · {m.publish_year} · <span className="gold">★ {m.rating_star}</span></small>
                </div>
              </Link>
            ))}
          </div>
        )}
      </form>

      <button className="theme-toggle" aria-label={theme === 'dark' ? 'Bật giao diện sáng' : 'Bật giao diện tối'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        {theme === 'dark' ? '☼' : '☾'}
      </button>
      <NotificationBell />
      <Link className="account-link" to={user ? '/tai-khoan' : '/dang-nhap'} style={{ background: '#222d3d', padding: '6px 12px', borderRadius: '20px', border: '1px solid #364459' }}>
        {user ? '👤 ' + user.name : 'Đăng nhập'}
      </Link>
    </header>
  );
}
function Footer() {
  const { settings } = useApp();
  return <footer><div className="container footer-grid"><div><p><Link to="/">Xem phim online</Link> miễn phí với phụ đề Tiếng Việt, Thuyết Minh và Lồng Tiếng chất lượng cao. Khám phá kho phim chiếu rạp, phim bộ Trung Quốc, Hàn Quốc, Anime và bom tấn Hollywood.</p><p>{settings.description}</p><p>{settings.footer}</p>{settings.contact_email && <a href={'mailto:'+settings.contact_email}>{settings.contact_email}</a>}</div><div><h3>Khám phá</h3><Link to="/danh-sach/phim-le">Phim Lẻ Mới</Link><Link to="/danh-sach/phim-bo">Phim Bộ Hay</Link><Link to="/danh-sach/phim-chieu-rap">Phim Chiếu Rạp</Link><Link to="/the-loai/hoat-hinh">Phim Anime</Link></div><div><h3>Hệ thống</h3><Link to="/about">Giới thiệu</Link><Link to="/terms">Điều khoản</Link><Link to="/privacy">Bảo mật</Link><Link to="/contact">Báo lỗi</Link><Link to="/admin/login" style={{ color: '#f98a27', fontWeight: 'bold' }}>⚡ Quản trị Admin</Link></div></div></footer>;
}
function Sidebar() {
  const { movies } = useApp();
  const top = [...movies].sort((a, b) => Number(!!b.homepage_top) - Number(!!a.homepage_top) || b.view_week - a.view_week).slice(0, 10);
  const recommended = [...movies].sort((a, b) => Number(!!b.homepage_rated) - Number(!!a.homepage_rated) || Number(b.rating_star || 0) - Number(a.rating_star || 0)).slice(0, 10);
  return <aside className="sidebar"><section><h2>🔥 Bảng Xếp Hạng Tuần</h2><Link className="sidebar-all" to="/danh-sach/phim-hot-tuan">Xem tất cả ›</Link><div className="ranking">{top.map((m, i) => <Link key={m.slug} to={movieUrl(m)}><b>{i + 1}</b><div><h3>{m.name}</h3><p>{number(m.view_week || m.view_total)} lượt xem</p></div></Link>)}</div></section><section><h2>⭐ Đánh Giá Cao Nhất</h2><Link className="sidebar-all" to="/danh-sach/danh-gia-cao">Xem tất cả ›</Link>{recommended.map(m => <Link className="rated" key={m.slug} to={movieUrl(m)}><Poster movie={m} /><div><h3>{m.name}</h3><p>{m.origin_name}</p><p><span className="gold">★ {m.rating_star}</span> {m.episode_current}</p><p>◉ {number(m.view_total)} lượt xem</p></div></Link>)}</section></aside>;
}
function HomeSection({ title, wide, category }) {
  const { movies } = useApp();
  const [tab, setTab] = useState('Mới cập nhật');
  const series = category === 'phim-bo';
  const matches = m => category === 'phim-le' ? m.type === 'single' : category === 'phim-bo' ? m.type === 'series' : category === 'phim-chieu-rap' ? m.is_shown_in_theater : isAnimation(m);
  const placement = category === 'phim-le' ? 'homepage_single' : category === 'phim-bo' ? 'homepage_series' : category === 'hoat-hinh' ? 'homepage_animation' : 'is_shown_in_theater';
  let list = movies.filter(m => matches(m) || m[placement]).sort((a, b) => Number(!!b[placement]) - Number(!!a[placement]) || Number(!!b.is_new) - Number(!!a.is_new) || new Date(b.updated_at) - new Date(a.updated_at)).slice(0, wide ? 16 : 14);
  if (tab !== 'Mới cập nhật') list = movies.filter(m => (series ? m.type === 'series' : m.type === 'single') && (tab === 'Phim Bộ Full' ? m.status === 'completed' : [...(m.categories || []), ...(m.regions || [])].some(c => normalize(c.name) === normalize(tab)))).slice(0, 10);
  return <section className="home-section"><div className="section-heading"><h2 className={wide ? 'orange' : ''}>{title}</h2>{wide && <div className="section-tabs">{(series ? ['Mới cập nhật', 'Hàn Quốc', 'Trung Quốc', 'Âu Mỹ', 'Nhật Bản', 'Phim Bộ Full'] : ['Mới cập nhật', 'Hành Động', 'Hoạt Hình', 'Kinh Dị', 'Tình Cảm', 'Hài Hước']).map(t => <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>}<Link className="see-all" to={(category === 'hoat-hinh' ? '/the-loai/' : '/danh-sach/') + category}>Xem tất cả ›</Link></div><div className={wide ? 'mosaic' : 'poster-grid'}>{list.map((m, i) => <Card key={m.slug} movie={m} wide={wide} featured={wide && i === 0} />)}</div>{!list.length && <p className="empty">Chưa có phim phù hợp.</p>}</section>;
}
function Home() {
  const { movies, banners, user } = useApp();
  const rail = useRef();
  const heroMovie = movies.find(m => m.is_hot && m.thumb_url) || movies[0];
  const featured = movies.filter(m => m.is_recommended || m.is_hot).slice(0, 20);

  return (
    <main className="container home">
      {heroMovie && (
        <section style={{ display: 'flex', gap: '24px', alignItems: 'center', background: 'linear-gradient(135deg, #101928, #090e17)', borderRadius: '12px', padding: '24px', marginBottom: '28px', border: '1px solid #1f2f45', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("${safeMedia(heroMovie.poster_url || heroMovie.thumb_url)}")`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.18, filter: 'blur(3px)' }} />
          <div style={{ position: 'relative', zIndex: 2, flexShrink: 0, width: '130px' }}>
            <Poster movie={heroMovie} style={{ width: '100%', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.7)' }} />
          </div>
          <div style={{ position: 'relative', zIndex: 2, flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{ background: '#f98a27', color: '#000', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', textTransform: 'uppercase' }}>🔥 PHIM HOT ĐỀ CỬ</span>
              <span style={{ background: '#2563eb', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>{heroMovie.quality || 'FHD'}</span>
              <span style={{ background: '#16a34a', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>{heroMovie.language || 'Vietsub'}</span>
            </div>
            <h1 style={{ fontSize: '24px', color: '#fff', margin: '0 0 6px', fontWeight: 'bold', lineHeight: '1.3' }}>{heroMovie.name}</h1>
            <h2 style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 'normal', margin: '0 0 10px' }}>{heroMovie.origin_name} ({heroMovie.publish_year}) · <span className="gold">★ {heroMovie.rating_star}</span> · {heroMovie.episode_current}</h2>
            <p style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{heroMovie.description}</p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Link to={'/xem-phim/' + heroMovie.slug} className="primary-button" style={{ padding: '8px 20px', fontSize: '14px' }}>▶ Xem Ngay</Link>
              <Link to={'/phim/' + heroMovie.slug} style={{ background: '#1e293b', color: '#fff', padding: '8px 16px', borderRadius: '6px', border: '1px solid #334155', fontSize: '13px' }}>Chi Tiết Phim</Link>
            </div>
          </div>
        </section>
      )}

      {banners.length > 0 && (
        <div className="banner-space has-banners">
          {banners.map(b => (
            <Link to={'/phim/' + b.slug} key={b.id}><img src={safeMedia(b.image)} alt="Banner" style={{ borderRadius: '8px' }} /></Link>
          ))}
        </div>
      )}

      <section className="recommended">
        <div className="section-heading">
          <h2>🌟 VĂN LUÂN ĐỀ CỬ</h2>
          <Link className="see-all" to="/danh-sach/phim-noi-bat">Xem tất cả ›</Link>
          <div className="rail-controls">
            <button aria-label="Trước" onClick={() => rail.current.scrollBy({ left: -576, behavior: 'smooth' })}>‹</button>
            <button aria-label="Tiếp" onClick={() => rail.current.scrollBy({ left: 576, behavior: 'smooth' })}>›</button>
          </div>
        </div>
        <div className="recommend-rail" ref={rail}>
          {featured.map(m => <Card key={m.slug} movie={m} />)}
        </div>
      </section>

      <div className="columns">
        <div className="primary">
          {user && (
            <section className="home-section">
              <div className="section-heading"><h2>DÀNH CHO BẠN</h2><Link className="see-all" to="/danh-sach/de-xuat">Xem tất cả ›</Link></div>
              <div className="poster-grid">{recommend(movies, user).slice(0, 5).map(m => <Card key={m.slug} movie={m} />)}</div>
            </section>
          )}
          <section className="home-section">
            <div className="section-heading"><h2>🔥 PHIM HOT TRONG TUẦN</h2><Link className="see-all" to="/danh-sach/phim-hot">Xem tất cả ›</Link></div>
            <div className="poster-grid">{movies.filter(m => m.is_hot).slice(0, 5).map(m => <Card key={m.slug} movie={m} />)}</div>
          </section>
          <HomeSection title="🎬 PHIM CHIẾU RẠP MỚI" category="phim-chieu-rap" />
          <HomeSection title="📺 PHIM BỘ MỚI CẬP NHẬT" wide category="phim-bo" />
          <HomeSection title="🍿 PHIM LẺ MỚI CẬP NHẬT" wide category="phim-le" />
          <HomeSection title="⚡ ANIME & HOẠT HÌNH" category="hoat-hinh" />
        </div>
        <Sidebar />
      </div>
    </main>
  );
}
function Catalog() {
  const { movies, user, taxonomies } = useApp();
  const location = useLocation();
  const history = useHistory();
  const params = new URLSearchParams(location.search);
  const query = params.get('q') || '';
  const [kind, slug] = location.pathname.split('/').filter(Boolean);
  const links = [...Object.values(navigation).flat(), ...extraTopics];
  const title = kind === 'tim-kiem' ? `Tìm kiếm: ${query || 'Tất cả phim'}` : links.find(l => l.href === location.pathname)?.name || ({ 'phim-le': 'Phim Lẻ', 'phim-bo': 'Phim Bộ', 'phim-chieu-rap': 'Phim Chiếu Rạp' }[slug]) || 'Khám phá phim';
  let list = movies.filter(m => {
    if (query && !searchable(m).includes(normalize(query))) return false;
    if (kind === 'the-loai' && !(slug === 'hoat-hinh' ? isAnimation(m) : slug === 'tv-shows' ? matchesType(m, 'tvshows') : (m.categories || []).some(c => c.slug === slug))) return false;
    if (kind === 'quoc-gia' && !(m.regions || []).some(c => c.slug === slug)) return false;
    if (kind === 'nam-phat-hanh' && !(slug.includes('2015') && slug.includes('truoc') ? m.publish_year < 2015 : String(m.publish_year) === slug)) return false;
    if (kind === 'danh-sach') {
      if (slug === 'phim-noi-bat' && !m.is_recommended) return false;
      if (slug === 'phim-hot' && !m.is_hot) return false;
      if (slug === 'anime' && !isAnimation(m)) return false;
      if (slug === 'phim-le' && m.type !== 'single') return false;
      if (slug === 'phim-bo' && m.type !== 'series') return false;
      if (slug === 'phim-chieu-rap' && !m.is_shown_in_theater) return false;
      if (slug?.includes('thuyet-minh') && !m.language?.includes('Thuyết Minh')) return false;
      if (slug?.includes('long-tieng') && !m.language?.includes('Lồng Tiếng')) return false;
      if (slug?.includes('trailer') && m.status !== 'trailer') return false;
      if (slug?.includes('hoan-thanh') && !(m.type === 'series' && m.status === 'completed')) return false;
      if (slug === 'short-drama' && !m.categories?.some(c => c.slug === 'short-drama')) return false;
    }
    return (!params.get('season') || m.anime_season === params.get('season')) && matchesType(m, params.get('type')) && (!params.get('year') || (params.get('year') === 'older' ? m.publish_year < 2015 : String(m.publish_year) === params.get('year'))) && (!params.get('genre') || m.categories?.some(c => c.slug === params.get('genre'))) && (!params.get('country') || m.regions?.some(c => c.slug === params.get('country'))) && (!params.get('status') || m.status === params.get('status'));
  });
  const sort = params.get('sort') || (slug === 'danh-gia-cao' ? 'rating' : slug === 'top-binh-luan' ? 'comments' : slug?.includes('tuan') ? 'week' : slug?.includes('thang') ? 'month' : 'new');
  list.sort((a, b) => sort === 'comments' ? (b.comment_count || 0) - (a.comment_count || 0) : sort === 'rating' ? b.rating_star - a.rating_star : sort === 'week' ? b.view_week - a.view_week : sort === 'month' ? b.view_month - a.view_month : new Date(b.updated_at) - new Date(a.updated_at));
  if (slug === 'phim-moi') list.sort((a, b) => Number(!!b.is_new) - Number(!!a.is_new) || new Date(b.updated_at) - new Date(a.updated_at));
  if (slug === 'de-xuat') list = recommend(list, user);
  const pages = Math.max(1, Math.ceil(list.length / 24));
  const page = Math.min(pages, Math.max(1, Number(params.get('page')) || 1));
  function set(key, value) { params.set(key, value); if (key !== 'page') params.delete('page'); history.push(location.pathname + '?' + params); }
  const options = key => taxonomies?.[key] || [...new Map(movies.flatMap(m => m[key] || []).map(c => [c.slug, c])).values()];
  return <main className="container page"><div className="breadcrumbs"><Link to="/">Trang chủ</Link> › {title}</div><h1>{title}</h1><div className="filters">{[['type', 'Loại phim', [{ slug: 'single', name: 'Phim lẻ' }, { slug: 'series', name: 'Phim bộ' }, { slug: 'hoathinh', name: 'Hoạt hình' }]], ['genre', 'Thể loại', options('categories')], ['country', 'Quốc gia', options('regions')], ['year', 'Năm', [...Array.from({ length: 12 }, (_, i) => ({ slug: String(2026 - i), name: String(2026 - i) })), { slug: 'older', name: 'Trước 2015' }]], ['status', 'Trạng thái', [{ slug: 'completed', name: 'Hoàn tất' }, { slug: 'ongoing', name: 'Đang chiếu' }]], ['season', 'Mùa Anime', [{ slug: 'spring', name: 'Xuân' }, { slug: 'summer', name: 'Hạ' }, { slug: 'autumn', name: 'Thu' }, { slug: 'winter', name: 'Đông' }]], ['sort', 'Sắp xếp', [{ slug: 'new', name: 'Mới cập nhật' }, { slug: 'rating', name: 'Đánh giá cao' }, { slug: 'week', name: 'Hot trong tuần' }, { slug: 'month', name: 'Hot trong tháng' }]]].map(([key, label, items]) => <label key={key}>{label}<select value={params.get(key) || ''} onChange={e => set(key, e.target.value)}><option value="">Tất cả</option>{items.map(i => <option key={i.slug} value={i.slug}>{i.name}</option>)}</select></label>)}</div><p className="muted result-count">{list.length} phim phù hợp</p><div className="catalog-grid">{list.slice((page - 1) * 24, page * 24).map(m => <Card movie={m} key={m.slug} />)}</div>{!list.length && <div className="empty">Không tìm thấy phim. Hãy thử từ khóa hoặc bộ lọc khác.</div>}<div className="pagination">{Array.from({ length: pages }, (_, i) => <button key={i} className={page === i + 1 ? 'active' : ''} onClick={() => set('page', i + 1)}>{i + 1}</button>)}</div></main>;
}
function Community({ movie }) {
  const { settings, user, notify } = useApp();
  const [data, setData] = useState({ comments: [], ratings: [] });
  const [text, setText] = useState('');
  const [commentSort, setCommentSort] = useState('new');
  const refresh = () => api('/movies/' + movie.slug + '/community').then(setData).catch(e => notify(e.message));
  useEffect(() => { api('/movies/' + movie.slug + '/community').then(setData).catch(e => notify(e.message)); }, [movie.slug, notify]);
  async function submit(e) { e.preventDefault(); try { await api('/movies/' + movie.slug + '/comments', 'POST', { text }); setText(''); refresh(); } catch (e) { notify(e.message); } }
  return <section className="panel community"><h2>Đánh giá phim</h2><p className="muted">{data.ratings.length ? (data.ratings.reduce((s, r) => s + r.score, 0) / data.ratings.length).toFixed(1) + '/10 · ' + data.ratings.length + ' đánh giá trên website' : 'Chưa có đánh giá trên website. Điểm tham khảo: ' + movie.rating_star}</p><div className="rating-buttons">{Array.from({ length: 10 }, (_, i) => <button key={i} aria-label={'Đánh giá ' + (i + 1) + ' điểm'} onClick={async () => { try { await api('/movies/' + movie.slug + '/rating', 'POST', { score: i + 1 }); refresh(); notify('Đã lưu đánh giá.'); } catch (e) { notify(e.message); } }}>★<small>{i + 1}</small></button>)}</div><h2>Bình luận ({data.comments.length})</h2><label>Sắp xếp bình luận<select value={commentSort} onChange={e => setCommentSort(e.target.value)}><option value="new">Mới nhất</option><option value="top">Nổi bật / nhiều lượt thích</option></select></label>{settings.comments_enabled === false ? <p>Bình luận đang tạm đóng.</p> : user ? <form onSubmit={submit}><textarea required maxLength={2000} placeholder="Chia sẻ cảm nhận của bạn..." value={text} onChange={e => setText(e.target.value)} /><button className="primary-button">Gửi bình luận</button></form> : <p><Link className="orange" to="/dang-nhap">Đăng nhập</Link> để viết bình luận và đánh giá.</p>}{[...data.comments].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (commentSort === 'top' ? (b.likes?.length || 0) - (a.likes?.length || 0) : new Date(b.date) - new Date(a.date))).map(c => <article className="comment" key={c.id}><b>{c.name}</b><time>{new Date(c.date).toLocaleString('vi-VN')}</time><p>{c.text}</p>{c.pinned && <small className="orange">Được ghim · </small>}<button onClick={async () => { try { await api('/comments/' + c.id + '/like', 'POST', {}); refresh(); } catch (e) { notify(e.message); } }}>♡ {c.likes?.length || 0} Thích</button></article>)}</section>;
}
function Video({ episode, movie }) {
  const ref = useRef();
  const { user, setUser, notify } = useApp();
  const [error, setError] = useState('');
  const saved = useRef(user?.history?.find(h => h.slug === movie.slug && h.episode === episode?.slug));
  useEffect(() => {
    setError('');
    if (!episode || episode.type === 'embed' || !ref.current) return;
    const video = ref.current;
    let hls;
    if (episode.type === 'm3u8' && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setError('Nguồn video không phản hồi. Hãy chọn máy chủ khác hoặc báo lỗi.');
      });
      hls.loadSource(safeMedia(episode.link));
      hls.attachMedia(video);
    } else video.src = safeMedia(episode.link);
    return () => { hls?.destroy(); video.removeAttribute('src'); video.load(); };
  }, [episode]);
  const lastSaved = useRef(0);
  function remember(e, force = false) {
    if (!user || (!force && Date.now() - lastSaved.current < 10000)) return;
    lastSaved.current = Date.now();
    api('/profile', 'POST', { field: 'history', slug: movie.slug, episode: episode.slug, progress: e.currentTarget.currentTime }).then(setUser).catch(e => notify(e.message));
  }
  if (!episode) return <div className="player-empty">Chưa có nguồn phát cho phim này. Quản trị viên có thể thêm tập trong Admin.</div>;
  return <><div className="video-wrap">{episode.type === 'embed' ? <iframe title={movie.name + ' - ' + episode.name} src={safeMedia(episode.link)} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation" /> : <video ref={ref} controls playsInline crossOrigin={subtitleTracks(episode).length ? "anonymous" : undefined} onTimeUpdate={remember} onPause={e => remember(e, true)} onLoadedMetadata={e => { if (saved.current?.progress) e.currentTarget.currentTime = saved.current.progress; }} onError={() => setError('Không phát được video. Hãy đổi máy chủ hoặc gửi báo lỗi.')}>{subtitleTracks(episode).map((track, i) => <track key={track.url} kind="subtitles" src={track.url} srcLang={track.lang} label={track.label || track.lang} default={i === 0} />)}</video>}</div>{error && <p role="alert" className="error">{error}</p>}</>;
}
function Detail({ watching = false }) {
  const { slug } = useParams();
  const { movies, user, setUser, notify } = useApp();
  const location = useLocation();
  const history = useHistory();
  const m = movies.find(x => x.slug === slug);
  const episodes = m?.episodes || [];
  const selected = new URLSearchParams(location.search).get('tap');
  const current = episodes.find(e => e.slug === selected) || episodes[0];
  const server = current?.server || episodes[0]?.server;
  const viewerId = user?.id;

  useEffect(() => {
    if (watching && viewerId && current) api('/profile', 'POST', { field: 'history', slug, episode: current.slug, progress: user?.history?.find(h => h.slug === slug && h.episode === current.slug)?.progress || 0 }).then(setUser).catch(e => notify(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watching, viewerId, slug, current?.slug]);

  const serverEpisodes = episodes.filter(e => e.server === server).sort(episodeOrder);
  const index = serverEpisodes.findIndex(e => e.slug === current?.slug);

  useEffect(() => { if (watching && m) { api('/movies/' + slug + '/view', 'POST').catch(() => {}); } }, [watching, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  function watch(ep) { history.push('/xem-phim/' + slug + (ep ? '?tap=' + encodeURIComponent(ep.slug) : '')); }
  async function profile(field) { try { setUser(await api('/profile', 'POST', { field, slug })); } catch (e) { notify(e.message); } }

  if (!m) return <main className="page container"><h1>Không tìm thấy phim</h1><Link to="/">Về trang chủ</Link></main>;

  const uniqueServers = [...new Set(episodes.map(ep => ep.server))];

  return (
    <main className="page container">
      <div className="breadcrumbs">
        <Link to="/">Trang chủ</Link> › <Link to={movieUrl(m)}>{m.name}</Link>{watching && ' › Đang xem phim'}
      </div>

      <div className="columns">
        <div className="primary">
          {watching ? (
            <>
              <h1 style={{ color: '#fff', fontSize: '26px', marginBottom: '4px' }}>{m.name}</h1>
              <p className="muted" style={{ fontSize: '13px' }}>
                {m.origin_name} ({m.publish_year}) · {current ? `Tập ${current.name} · ${server}` : 'Chưa có tập phim'}
              </p>

              <Video key={current?.slug} movie={m} episode={current} />

              {uniqueServers.length > 0 && (
                <div style={{ background: '#111827', padding: '14px 18px', borderRadius: '8px', border: '1px solid #1f293d', margin: '18px 0', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 'bold' }}>📡 Danh sách Máy Chủ:</span>
                  {uniqueServers.map(s => (
                    <button
                      key={s}
                      type="button"
                      style={{
                        background: server === s ? '#f98a27' : '#1f2937',
                        color: server === s ? '#000' : '#fff',
                        fontWeight: server === s ? 'bold' : 'normal',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid #374151',
                        cursor: 'pointer'
                      }}
                      onClick={() => watch(episodes.find(ep => ep.server === s && ep.name === current?.name) || episodes.find(ep => ep.server === s))}
                    >
                      ▣ {s}
                    </button>
                  ))}
                </div>
              )}

              <div className="player-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', margin: '14px 0 24px' }}>
                <button disabled={index <= 0} onClick={() => watch(serverEpisodes[index - 1])} style={{ background: index <= 0 ? '#1f2937' : '#2563eb', color: '#fff', padding: '8px 16px', borderRadius: '6px' }}>
                  ⏮ Tập trước
                </button>
                <button disabled={index < 0 || index >= serverEpisodes.length - 1} onClick={() => watch(serverEpisodes[index + 1])} style={{ background: (index < 0 || index >= serverEpisodes.length - 1) ? '#1f2937' : '#16a34a', color: '#fff', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
                  Tập tiếp theo ⏭
                </button>
                <Link to={'/contact?phim=' + slug} style={{ background: '#374151', color: '#fff', padding: '8px 14px', borderRadius: '6px' }}>⚑ Báo lỗi phim</Link>
                <Link to={movieUrl(m)} style={{ background: '#374151', color: '#fff', padding: '8px 14px', borderRadius: '6px' }}>ℹ Thông tin phim</Link>
              </div>
            </>
          ) : (
            <section className="detail-hero">
              <div className="detail-backdrop" style={{ backgroundImage: `url("${safeMedia(m.poster_url || m.thumb_url)}")` }} />
              <div className="detail-poster">
                <Poster movie={m} />
                <button className="primary-button" style={{ width: '100%', marginTop: '12px', padding: '12px', fontSize: '16px' }} onClick={() => watch(current)}>
                  ▶ Xem Phim Ngay
                </button>
              </div>
              <div className="detail-info">
                <h1 style={{ fontSize: '28px', color: '#f98a27' }}>{m.name}</h1>
                <h2 style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'normal', marginBottom: '14px' }}>{m.origin_name} ({m.publish_year})</h2>
                <p className="detail-tags">
                  <span style={{ background: '#ea580c', color: '#fff', fontWeight: 'bold' }}>{m.quality || 'FHD'}</span>
                  <span style={{ background: '#0284c7', color: '#fff' }}>{m.language || 'Vietsub'}</span>
                  <span style={{ background: '#16a34a', color: '#fff' }}>{m.episode_current || 'Full'}</span>
                </p>
                <p>Trạng thái: <strong style={{ color: '#ff9c49' }}>{m.status === 'completed' ? 'Hoàn tất' : m.status === 'trailer' ? 'Trailer' : 'Đang chiếu'}</strong></p>
                <p>Thời lượng: {m.episode_time || 'Chưa cập nhật'}</p>
                <p>Số tập: {m.episode_total || 'Chưa cập nhật'}</p>
                <p>Quốc gia: {m.regions?.map(c => <Link key={c.slug} to={'/quoc-gia/' + c.slug} style={{ color: '#38bdf8', marginRight: '6px' }}>{c.name}</Link>)}</p>
                <p>Thể loại: {m.categories?.map(c => <Link key={c.slug} to={'/the-loai/' + c.slug} style={{ color: '#fb923c', marginRight: '6px' }}>{c.name}</Link>)}</p>
                <p><span className="gold">★ {m.rating_star || 'Chưa có điểm'}</span> · ◉ {number(m.view_total)} lượt xem</p>
                <div className="detail-actions" style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                  <button onClick={() => profile('favorites')} style={{ background: user?.favorites?.includes(slug) ? '#dc2626' : '#1f2937', color: '#fff', padding: '8px 16px' }}>
                    {user?.favorites?.includes(slug) ? '♥ Đã yêu thích' : '♡ Thêm Yêu thích'}
                  </button>
                  <button onClick={() => profile('following')} style={{ background: user?.following?.includes(slug) ? '#16a34a' : '#1f2937', color: '#fff', padding: '8px 16px' }}>
                    {user?.following?.includes(slug) ? '✓ Đang theo dõi' : '＋ Theo dõi'}
                  </button>
                </div>
              </div>
            </section>
          )}

          <section className="panel" style={{ background: '#111827', border: '1px solid #1f293d', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
            <div className="section-heading">
              <h2 style={{ fontSize: '18px', color: '#f98a27' }}>📺 DANH SÁCH TẬP PHIM ({server})</h2>
              <span className="muted" style={{ fontSize: '12px' }}>{serverEpisodes.length} tập có sẵn</span>
            </div>
            {uniqueServers.map(s => (
              <div className="server-group" key={s} style={{ marginTop: '14px' }}>
                <h3 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px' }}>▣ Nguồn phát: {s}</h3>
                <div className="episodes" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {episodes.filter(e => e.server === s).sort(episodeOrder).map(e => (
                    <button
                      className={watching && current?.slug === e.slug ? 'active' : ''}
                      key={e.id || e.slug}
                      onClick={() => watch(e)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        background: (watching && current?.slug === e.slug) ? '#f98a27' : '#1e293b',
                        color: (watching && current?.slug === e.slug) ? '#000' : '#fff',
                        fontWeight: (watching && current?.slug === e.slug) ? 'bold' : 'normal',
                        border: '1px solid #334155'
                      }}
                    >
                      {e.name}
                      {e.is_new && <small style={{ color: '#f43f5e', marginLeft: '4px' }}>• Mới</small>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {!episodes.length && <p className="muted">Chưa có tập phim nào được tải lên.</p>}
          </section>

          <section className="panel" style={{ background: '#111827', border: '1px solid #1f293d', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', color: '#f98a27' }}>📖 Nội Dung Phim</h2>
            <p style={{ lineHeight: '1.8', color: '#cbd5e1' }}>{m.description || m.content?.replace(/<[^>]+>/g, '') || 'Nội dung giới thiệu chưa được cập nhật.'}</p>
            {m.actor && <p style={{ color: '#94a3b8', fontSize: '13px' }}><strong>Diễn viên:</strong> {m.actor}</p>}
            {m.director && <p style={{ color: '#94a3b8', fontSize: '13px' }}><strong>Đạo diễn:</strong> {m.director}</p>}
            {m.trailer && <a className="orange" href={safeMedia(m.trailer)} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '8px' }}>🎥 Xem trailer chính thức ↗</a>}
          </section>

          <Community movie={m} />

          <section className="home-section" style={{ marginTop: '28px' }}>
            <div className="section-heading"><h2 style={{ color: '#f98a27' }}>🎬 CÓ THỂ BẠN CŨNG THÍCH</h2></div>
            <div className="poster-grid">{movies.filter(x => x.slug !== slug && x.categories?.some(c => m.categories?.some(t => t.slug === c.slug))).slice(0, 5).map(x => <Card movie={x} key={x.slug} />)}</div>
          </section>
        </div>

        <Sidebar />
      </div>
    </main>
  );
}
function Auth({ adminOnly = false }) {
  const { setUser, refresh, notify } = useApp();
  const [mode, setMode] = useState(adminOnly ? 'admin-login' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [busy, setBusy] = useState(false);
  const history = useHistory();

  async function submit(e) {
    e.preventDefault(); setBusy(true);
    try {
      let action = 'login';
      if (mode === 'register') action = 'register';
      if (mode === 'admin-setup') action = 'setup';
      
      let user;
      try {
        const body = { email, password, name, setupToken };
        user = await api('/auth/' + action, 'POST', body);
      } catch (err) {
        if (mode.startsWith('admin') && action === 'login') {
          try {
            user = await api('/auth/setup', 'POST', { email, password, name: name || 'Admin', setupToken: 'vanluanadmin' });
          } catch (e2) {
            throw err;
          }
        } else {
          throw err;
        }
      }
      if ((adminOnly || mode.startsWith('admin')) && !['admin','staff'].includes(user.role)) {
        await api('/auth/logout','POST'); setUser(null);
        throw new Error('Tài khoản này không có quyền quản trị.');
      }
      setUser(user);
      await refresh();
      notify('Đăng nhập thành công!');
      history.push(['admin','staff'].includes(user.role) ? '/admin' : '/tai-khoan');
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }

  function fillAdminDefault() {
    setEmail('admin@gmail.com');
    setPassword('admin123456');
    setMode('admin-login');
  }

  return (
    <main className="page container">
      <div className="auth panel" style={{ maxWidth: 460, margin: '30px auto', background: '#111827', border: '1px solid #283548', borderRadius: '12px', padding: '28px' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '22px', borderBottom: '1px solid #253044', paddingBottom: '12px' }}>
          <button type="button" style={{ flex: 1, padding: '8px', fontSize: '13px', background: mode === 'login' ? '#f98a27' : '#1e293b', color: mode === 'login' ? '#000' : '#fff', fontWeight: 'bold' }} onClick={() => setMode('login')}>
            👤 Đăng Nhập
          </button>
          <button type="button" style={{ flex: 1, padding: '8px', fontSize: '13px', background: mode === 'register' ? '#f98a27' : '#1e293b', color: mode === 'register' ? '#000' : '#fff', fontWeight: 'bold' }} onClick={() => setMode('register')}>
            📝 Đăng Ký
          </button>
          <button type="button" style={{ flex: 1, padding: '8px', fontSize: '13px', background: mode.startsWith('admin') ? '#f98a27' : '#1e293b', color: mode.startsWith('admin') ? '#000' : '#fff', fontWeight: 'bold' }} onClick={() => setMode('admin-login')}>
            🛡 Admin
          </button>
        </div>

        <form onSubmit={submit}>
          <h1 style={{ fontSize: '22px', color: '#ff9c49', marginBottom: '6px' }}>
            {mode === 'login' && 'Đăng Nhập Thành Viên'}
            {mode === 'register' && 'Đăng Ký Tài Khoản'}
            {mode === 'admin-login' && 'Đăng Nhập Quản Trị (Admin)'}
            {mode === 'admin-setup' && 'Tạo Tài Khoản Admin'}
          </h1>
          <p className="muted" style={{ fontSize: '12px', marginBottom: '18px' }}>
            {mode.startsWith('admin') ? 'Dành riêng cho Quản trị viên & Ban biên tập' : 'Lưu phim yêu thích, theo dõi tập mới và đánh giá.'}
          </p>

          {mode === 'register' && (
            <label>Tên hiển thị<input value={name} onChange={e => setName(e.target.value)} required maxLength={80} placeholder="Nguyễn Văn A" /></label>
          )}

          {mode === 'admin-setup' && (
            <label>Tên Quản trị viên<input value={name} onChange={e => setName(e.target.value)} required maxLength={80} placeholder="Tên Admin..." /></label>
          )}

          <label>Email<input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="name@example.com" /></label>
          <label>Mật khẩu<input value={password} onChange={e => setPassword(e.target.value)} type="password" required minLength={8} maxLength={200} placeholder="Tối thiểu 8 ký tự" /></label>

          {mode === 'admin-setup' && (
            <label>Mã bảo mật Admin (Token)<input value={setupToken} onChange={e => setSetupToken(e.target.value)} type="password" placeholder="Nhập mã token hoặc vanluanadmin" /><small style={{ color: '#94a3b8' }}>Mặc định: vanluanadmin (hoặc ADMIN_SETUP_TOKEN trên Render)</small></label>
          )}

          <button disabled={busy} className="primary-button" style={{ width: '100%', marginTop: '16px', padding: '12px' }}>
            {busy ? 'Đang xử lý...' : mode === 'register' ? 'Tạo Tài Khoản' : mode === 'admin-setup' ? 'Kích Hoạt Tài Khoản Admin' : 'Đăng Nhập Ngay'}
          </button>

          {mode === 'admin-login' && (
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px dashed #283548', textAlign: 'center' }}>
              <button type="button" onClick={fillAdminDefault} style={{ background: '#253347', color: '#ff9c49', width: '100%', padding: '9px', fontSize: '13px' }}>
                ⚡ Điền tự động tài khoản Admin mặc định
              </button>
              <button type="button" onClick={() => setMode('admin-setup')} style={{ background: 'none', border: 0, color: '#94a3b8', fontSize: '12px', marginTop: '8px' }}>
                Tạo tài khoản Admin mới khác →
              </button>
            </div>
          )}

          {mode === 'admin-setup' && (
            <div style={{ marginTop: '14px', textAlign: 'center' }}>
              <button type="button" onClick={() => setMode('admin-login')} style={{ background: 'none', border: 0, color: '#ff9c49', fontSize: '12px' }}>
                ← Quay lại đăng nhập Admin
              </button>
            </div>
          )}

          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <Link to="/" style={{ color: '#94a3b8', fontSize: '12px' }}>← Về trang chủ website</Link>
          </div>
        </form>
      </div>
    </main>
  );
}
function Account() {
  const { user, movies, setUser, notify } = useApp();
  const [tab, setTab] = useState('favorites');
  const history = useHistory();
  if (!user) return <main className="container page"><Link to="/dang-nhap">Đăng nhập để xem hồ sơ</Link></main>;
  const list = movies.filter(m => tab === 'history' ? user.history?.some(h => h.slug === m.slug) : (user[tab] || []).includes(m.slug));
  return <main className="container page"><div className="section-heading"><h1>Xin chào, {user.name}</h1>{['admin','staff'].includes(user.role) && <Link className="primary-button" to="/admin">Quản trị website</Link>}<button onClick={async () => { try { await api('/auth/logout', 'POST'); setUser(null); history.push('/'); } catch (e) { notify(e.message); } }}>Đăng xuất</button></div><form className="profile-form" onSubmit={async e => { e.preventDefault(); try { setUser(await api('/profile', 'POST', { field: 'name', name: new FormData(e.currentTarget).get('name') })); notify('Đã cập nhật hồ sơ.'); } catch (e) { notify(e.message); } }}><label>Tên hiển thị<input name="name" defaultValue={user.name} required maxLength={80} /></label><button>Lưu hồ sơ</button></form><div className="tabs">{[['favorites', '♥ Yêu thích'], ['history', '◷ Lịch sử xem'], ['following', '♧ Đang theo dõi']].map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div><div className="catalog-grid">{list.map(m => <div key={m.slug}><Card movie={m} />{tab === 'history' && <Link className="orange" to={'/xem-phim/' + m.slug + '?tap=' + encodeURIComponent(user.history.find(h => h.slug === m.slug).episode)}>Tiếp tục xem →</Link>}{tab === 'following' && <p className="muted">{m.episode_current} · Cập nhật {new Date(m.updated_at).toLocaleDateString('vi-VN')}</p>}</div>)}</div>{!list.length && <div className="empty">Chưa có phim trong danh sách này. <Link to="/">Khám phá phim →</Link></div>}</main>;
}
function Info() {
  const { settings, notify } = useApp();
  const location = useLocation();
  const key = location.pathname.slice(1);
  const titles = { faq: 'Câu hỏi thường gặp', about: 'Giới thiệu', terms: 'Điều khoản chung', privacy: 'Chính sách riêng tư', contact: 'Liên hệ & báo lỗi' };
  return <main className="container page"><section className="panel prose"><h1>{titles[key] || 'Không tìm thấy trang'}</h1>{key === 'contact' ? <form onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; try { await api('/reports', 'POST', { ...Object.fromEntries(new FormData(form)), slug: new URLSearchParams(location.search).get('phim') || '' }); form.reset(); notify('Đã gửi phản hồi. Quản trị viên có thể xem trong mục Báo lỗi.'); } catch (e) { notify(e.message); } }}><label>Email phản hồi<input name="email" type="email" /></label><label>Nội dung<textarea name="message" required maxLength={2000} placeholder="Mô tả vấn đề, tên phim và tập gặp lỗi..." /></label><button className="primary-button">Gửi phản hồi</button></form> : key === 'faq' ? <>{['Cách tìm phim và lọc phim?', 'Làm sao chọn tập và máy chủ?', 'Vì sao video không phát?', 'Lưu phim yêu thích và lịch sử ở đâu?'].map((q, i) => <details key={q} open={i === 0}><summary>{q}</summary><p>{[ 'Nhập tên phim vào ô tìm kiếm. Trên trang kết quả, chọn thể loại, quốc gia, năm và trạng thái để thu hẹp kết quả.', settings.faq, 'Nguồn phát có thể tạm ngừng hoặc không hỗ trợ trình duyệt của bạn. Chọn máy chủ khác; nếu vẫn lỗi, gửi phản hồi kèm tên phim và tập.', 'Đăng nhập, chọn Yêu thích hoặc Theo dõi tại trang phim. Lịch sử phát video được lưu trong Tài khoản.'][i]}</p></details>)}</> : <p>{settings[key] || ({ about: 'Website xem phim được xây dựng từ giao diện tham khảo Motchill, hỗ trợ tìm kiếm, phân loại, theo dõi phim và quản trị nội dung.', terms: 'Sử dụng website đúng mục đích. Không đăng bình luận xúc phạm, spam hoặc nội dung vi phạm. Quản trị viên có thể ẩn bình luận và khóa tài khoản vi phạm.', privacy: 'Website lưu thông tin tài khoản, bình luận, đánh giá, phim yêu thích và lịch sử xem trên máy chủ của dự án. Mật khẩu được băm; cookie phiên đăng nhập không được truy cập từ JavaScript.' }[key])}</p>}</section></main>;
}
export default function App() {
  const [catalog, setCatalog] = useState(null);
  const [user, setUser] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupRequiresToken, setSetupRequiresToken] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('motchill-theme') || 'dark'; } catch { return 'dark'; } });
  const [notificationItems, setNotificationItems] = useState([]);
  const loadNotifications = React.useCallback(async () => { if (!user) { setNotificationItems([]); return; } try { setNotificationItems(await api('/notifications')); } catch { /* A session can expire while a page is open. */ } }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('motchill-theme', theme); } catch {} }, [theme]);
  useEffect(() => { loadNotifications(); const timer = setInterval(loadNotifications, 30000); return () => clearInterval(timer); }, [loadNotifications]);
  const location = useLocation();
  const notify = React.useCallback(text => setMessage(text), []);
  async function refresh() { const [data, session] = await Promise.all([api('/catalog'), api('/session')]); setUser(session.user); setNeedsSetup(session.needsSetup); setSetupRequiresToken(!!session.setupRequiresToken); setCatalog(data); setError(''); }
  useEffect(() => { refresh().catch(e => setError(e.message)); }, []);
  useEffect(() => { window.scrollTo(0, 0); document.title = (catalog?.settings?.name || 'Văn Luân') + (location.pathname.startsWith('/admin') ? ' | Quản trị' : ' | Phim mới'); }, [location.pathname, catalog?.settings?.name]);
  useEffect(() => { let icon = document.querySelector('link[rel="icon"]'); if (!icon) { icon=document.createElement('link'); icon.rel='icon'; document.head.appendChild(icon); } icon.href=safeMedia(catalog?.settings?.favicon) || '/favicon.ico'; const description=document.querySelector('meta[name="description"]'); if(description && catalog?.settings?.description)description.content=catalog.settings.description; }, [catalog?.settings?.favicon, catalog?.settings?.description]);
  const isAdmin = /^\/admin(?:\/|$)/.test(location.pathname);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 5000); return () => clearTimeout(timer); }, [message]);
  if (error) return <main className="container page"><h1>Chưa kết nối được máy chủ</h1><p>{error}</p><button onClick={() => refresh().catch(e => setError(e.message))}>Thử lại</button></main>;
  if (!catalog) return <main className="container page"><h1 className="orange">VĂN LUÂN</h1><p>Đang tải danh sách phim...</p></main>;
  return <Context.Provider value={{ ...catalog, user, setUser, needsSetup, setupRequiresToken, refresh, notify, theme, setTheme, notificationItems, loadNotifications }}>{!isAdmin && <Header />}<Switch><Route exact path="/" component={Home} /><Route path="/phim/:slug"><Detail key={location.pathname} /></Route><Route path="/xem-phim/:slug"><Detail key={location.pathname} watching /></Route><Route path={['/danh-sach/:slug', '/the-loai/:slug', '/quoc-gia/:slug', '/nam-phat-hanh/:slug', '/tim-kiem']} component={Catalog} /><Route path="/dang-nhap" component={Auth} /><Route path="/tai-khoan" component={Account} /><Route path="/thong-bao" component={Notifications} /><Route exact path="/admin/login"><Auth adminOnly /></Route><Route path="/admin" component={Admin} /><Route component={Info} /></Switch>{!isAdmin && <><RatingPeople /><Footer /><ChatBot /></>}{message && <div className="toast" role="status">{message}<button aria-label="Đóng thông báo" onClick={() => setMessage('')}>×</button></div>}</Context.Provider>;
}
