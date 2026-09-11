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
  const menus = { ...navigation, 'Thể Loại': taxonomies?.categories?.map(c => ({ name: c.name, href: '/the-loai/' + c.slug })) || navigation['Thể Loại'], 'Quốc Gia': taxonomies?.regions?.map(c => ({ name: c.name, href: '/quoc-gia/' + c.slug })) || navigation['Quốc Gia'], 'Chủ Đề Phim': [...navigation['Chủ Đề Phim'], ...extraTopics] };
  const suggestions = query.trim() ? movies.filter(m => searchable(m).includes(normalize(query.trim()))).slice(0, 6) : [];
  useEffect(() => { setOpen(''); setMobile(false); setSuggest(false); }, [location.pathname, location.search]);
  return <header className="site-header"><Link className="brand" to="/" aria-label={settings.name}><span className="brand-name">Văn Luân</span></Link><button className="mobile-toggle" onClick={() => setMobile(!mobile)} aria-label="Mở menu" aria-expanded={mobile}>☰</button>
    <nav className={mobile ? 'nav open' : 'nav'}><Link to="/">{settings.name}</Link><Link to="/danh-sach/phim-le">Phim Lẻ</Link><Link to="/danh-sach/phim-bo">Phim Bộ</Link>{Object.entries(menus).map(([title, links]) => <div className="nav-group" key={title} onMouseEnter={() => setOpen(title)} onMouseLeave={() => setOpen('')}><button aria-expanded={open === title} onClick={() => setOpen(open === title ? '' : title)} onKeyDown={e => e.key === 'Escape' && setOpen('')}>{title} <span>⌄</span></button>{open === title && <div className="dropdown">{links.map(l => <Link key={l.href} to={l.href}>{l.name}</Link>)}</div>}</div>)}</nav>
    <form className="search" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setSuggest(false); }} onSubmit={e => { e.preventDefault(); history.push('/tim-kiem?q=' + encodeURIComponent(query.trim())); }}><input onFocus={() => setSuggest(true)} onKeyDown={e => e.key === 'Escape' && setSuggest(false)} aria-label="Tìm kiếm phim" placeholder="Tìm tên phim..." value={query} onChange={e => setQuery(e.target.value)} /><button aria-label="Tìm kiếm">⌕</button>{suggest && suggestions.length > 0 && <div className="search-suggestions">{suggestions.map(m => <Link key={m.slug} to={movieUrl(m)} onClick={() => setSuggest(false)}><Poster movie={m} /><span>{m.name}<small>{m.origin_name} · {m.publish_year}</small></span></Link>)}</div>}</form><button className="theme-toggle" aria-label={theme === 'dark' ? 'Bật giao diện sáng' : 'Bật giao diện tối'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☼' : '☾'}</button><NotificationBell /><Link className="account-link" to={user ? '/tai-khoan' : '/dang-nhap'}>{user ? '♙ ' + user.name : 'Đăng nhập'}</Link>
  </header>;
}
function Footer() {
  const { settings } = useApp();
  return <footer><div className="container footer-grid"><div><p><Link to="/">Xem phim online</Link> với phụ đề Tiếng Việt, Thuyết Minh và Lồng Tiếng. Khám phá phim chiếu rạp, phim bộ Trung Quốc, Hàn Quốc và nhiều thể loại khác.</p><p>{settings.description}</p></div><div><h3>Trợ giúp</h3><Link to="/terms">Điều khoản chung</Link><Link to="/privacy">Chính sách riêng tư</Link><a href="/sitemap.xml">Sitemap</a><a href="/movies.xml">RSS Feed</a></div><div><h3>About</h3><Link to="/">{settings.name}</Link><Link to="/about">Giới thiệu</Link><Link to="/faq">FAQ</Link><Link to="/contact">Liên hệ</Link><Link to="/admin">Quản trị</Link></div></div></footer>;
}
function Sidebar() {
  const { movies } = useApp();
  const top = [...movies].sort((a, b) => b.view_week - a.view_week).slice(0, 10);
  const recommended = [...movies].sort((a, b) => Number(b.rating_star || 0) - Number(a.rating_star || 0)).slice(0, 10);
  return <aside className="sidebar"><section><h2>Phim Hot Trong Tuần</h2><Link className="sidebar-all" to="/danh-sach/phim-hot-tuan">Xem tất cả ›</Link><div className="ranking">{top.map((m, i) => <Link key={m.slug} to={movieUrl(m)}><b>{i + 1}</b><div><h3>{m.name}</h3><p>{number(m.view_week)} lượt xem</p></div></Link>)}</div></section><section><h2>Đánh giá cao</h2><Link className="sidebar-all" to="/danh-sach/danh-gia-cao">Xem tất cả ›</Link>{recommended.map(m => <Link className="rated" key={m.slug} to={movieUrl(m)}><Poster movie={m} /><div><h3>{m.name}</h3><p>{m.origin_name}</p><p><span className="gold">★ {m.rating_star}</span> {m.episode_current}</p><p>◉ {number(m.view_total)} lượt xem</p></div></Link>)}</section></aside>;
}
function HomeSection({ title, wide, category }) {
  const { movies } = useApp();
  const [tab, setTab] = useState('Mới cập nhật');
  const series = category === 'phim-bo';
  const matches = m => category === 'phim-le' ? m.type === 'single' : category === 'phim-bo' ? m.type === 'series' : category === 'phim-chieu-rap' ? m.is_shown_in_theater : isAnimation(m);
  let list = movies.filter(matches).sort((a, b) => Number(!!b.is_new) - Number(!!a.is_new) || new Date(b.updated_at) - new Date(a.updated_at)).slice(0, wide ? 16 : 14);
  if (tab !== 'Mới cập nhật') list = movies.filter(m => (series ? m.type === 'series' : m.type === 'single') && (tab === 'Phim Bộ Full' ? m.status === 'completed' : [...(m.categories || []), ...(m.regions || [])].some(c => normalize(c.name) === normalize(tab)))).slice(0, 9);
  return <section className="home-section"><div className="section-heading"><h2 className={wide ? 'orange' : ''}>{title}</h2>{wide && <div className="section-tabs">{(series ? ['Mới cập nhật', 'Hàn Quốc', 'Trung Quốc', 'Âu Mỹ', 'Phim Bộ Full'] : ['Mới cập nhật', 'Hành Động', 'Hoạt Hình', 'Kinh Dị', 'Hài Hước']).map(t => <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>}<Link className="see-all" to={(category === 'hoat-hinh' ? '/the-loai/' : '/danh-sach/') + category}>Xem tất cả ›</Link></div><div className={wide ? 'mosaic' : 'poster-grid'}>{list.map((m, i) => <Card key={m.slug} movie={m} wide={wide} featured={wide && i === 0} />)}</div>{!list.length && <p className="empty">Chưa có phim phù hợp.</p>}</section>;
}
function Home() {
  const { movies, banners, user } = useApp();
  const rail = useRef();
  const featured = movies.filter(m => m.is_recommended).slice(0, 20);
  return <main className="container home"><div className={banners.length ? 'banner-space has-banners' : 'banner-space'}>{banners.map(b => <Link to={'/phim/' + b.slug} key={b.id}><img src={safeMedia(b.image)} alt="Phim nổi bật" /></Link>)}</div><section className="recommended"><div className="section-heading"><h2>MOTCHILL ĐỀ CỬ</h2><Link className="see-all" to="/danh-sach/phim-noi-bat">Xem tất cả ›</Link><div className="rail-controls"><button aria-label="Phim đề cử trước" onClick={() => rail.current.scrollBy({ left: -576, behavior: 'smooth' })}>‹</button><button aria-label="Phim đề cử tiếp theo" onClick={() => rail.current.scrollBy({ left: 576, behavior: 'smooth' })}>›</button></div></div><div className="recommend-rail" ref={rail}>{featured.map(m => <Card key={m.slug} movie={m} />)}</div></section><div className="columns"><div className="primary">{user && <section className="home-section"><div className="section-heading"><h2>DÀNH CHO BẠN</h2><Link className="see-all" to="/danh-sach/de-xuat">Xem tất cả ›</Link></div><div className="poster-grid">{recommend(movies, user).slice(0, 5).map(m => <Card key={m.slug} movie={m} />)}</div></section>}<section className="home-section"><div className="section-heading"><h2>PHIM HOT</h2><Link className="see-all" to="/danh-sach/phim-hot">Xem tất cả ›</Link></div><div className="poster-grid">{movies.filter(m => m.is_hot).slice(0, 5).map(m => <Card key={m.slug} movie={m} />)}</div>{!movies.some(m => m.is_hot) && <p className="muted">Chưa có phim được đánh dấu hot.</p>}</section><HomeSection title="PHIM LẺ MỚI" wide category="phim-le" /><HomeSection title="PHIM CHIẾU RẠP" category="phim-chieu-rap" /><HomeSection title="PHIM BỘ MỚI" wide category="phim-bo" /><HomeSection title="PHIM HOẠT HÌNH" category="hoat-hinh" /></div><Sidebar /></div></main>;
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
  const { user, notify } = useApp();
  const [data, setData] = useState({ comments: [], ratings: [] });
  const [text, setText] = useState('');
  const [commentSort, setCommentSort] = useState('new');
  const refresh = () => api('/movies/' + movie.slug + '/community').then(setData).catch(e => notify(e.message));
  useEffect(() => { api('/movies/' + movie.slug + '/community').then(setData).catch(e => notify(e.message)); }, [movie.slug, notify]);
  async function submit(e) { e.preventDefault(); try { await api('/movies/' + movie.slug + '/comments', 'POST', { text }); setText(''); refresh(); } catch (e) { notify(e.message); } }
  return <section className="panel community"><h2>Đánh giá phim</h2><p className="muted">{data.ratings.length ? (data.ratings.reduce((s, r) => s + r.score, 0) / data.ratings.length).toFixed(1) + '/10 · ' + data.ratings.length + ' đánh giá trên website' : 'Chưa có đánh giá trên website. Điểm tham khảo: ' + movie.rating_star}</p><div className="rating-buttons">{Array.from({ length: 10 }, (_, i) => <button key={i} aria-label={'Đánh giá ' + (i + 1) + ' điểm'} onClick={async () => { try { await api('/movies/' + movie.slug + '/rating', 'POST', { score: i + 1 }); refresh(); notify('Đã lưu đánh giá.'); } catch (e) { notify(e.message); } }}>★<small>{i + 1}</small></button>)}</div><h2>Bình luận ({data.comments.length})</h2><label>Sắp xếp bình luận<select value={commentSort} onChange={e => setCommentSort(e.target.value)}><option value="new">Mới nhất</option><option value="top">Nổi bật / nhiều lượt thích</option></select></label>{user ? <form onSubmit={submit}><textarea required maxLength={2000} placeholder="Chia sẻ cảm nhận của bạn..." value={text} onChange={e => setText(e.target.value)} /><button className="primary-button">Gửi bình luận</button></form> : <p><Link className="orange" to="/dang-nhap">Đăng nhập</Link> để viết bình luận và đánh giá.</p>}{[...data.comments].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (commentSort === 'top' ? (b.likes?.length || 0) - (a.likes?.length || 0) : new Date(b.date) - new Date(a.date))).map(c => <article className="comment" key={c.id}><b>{c.name}</b><time>{new Date(c.date).toLocaleString('vi-VN')}</time><p>{c.text}</p>{c.pinned && <small className="orange">Được ghim · </small>}<button onClick={async () => { try { await api('/comments/' + c.id + '/like', 'POST', {}); refresh(); } catch (e) { notify(e.message); } }}>♡ {c.likes?.length || 0} Thích</button></article>)}</section>;
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
  const server = current?.server;
  const viewerId = user?.id;
  useEffect(() => {
    if (watching && viewerId && current) api('/profile', 'POST', { field: 'history', slug, episode: current.slug, progress: user?.history?.find(h => h.slug === slug && h.episode === current.slug)?.progress || 0 }).then(setUser).catch(e => notify(e.message));
    // Record episode entry once; playback progress is saved by Video.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watching, viewerId, slug, current?.slug]);
  const serverEpisodes = episodes.filter(e => e.server === server).sort(episodeOrder);
  const index = serverEpisodes.indexOf(current);
  useEffect(() => { if (watching && m) { api('/movies/' + slug + '/view', 'POST').catch(() => {}); } }, [watching, slug]); // eslint-disable-line react-hooks/exhaustive-deps
  function watch(ep) { history.push('/xem-phim/' + slug + (ep ? '?tap=' + encodeURIComponent(ep.slug) : '')); }
  async function profile(field) { try { setUser(await api('/profile', 'POST', { field, slug })); } catch (e) { notify(e.message); } }
  if (!m) return <main className="page container"><h1>Không tìm thấy phim</h1><Link to="/">Về trang chủ</Link></main>;
  return <main className="page container"><div className="breadcrumbs"><Link to="/">Trang chủ</Link> › <Link to={movieUrl(m)}>{m.name}</Link>{watching && ' › Xem phim'}</div><div className="columns"><div className="primary">{watching ? <><h1>{m.name}</h1><p className="muted">{current ? `${server} · Tập ${current.name}` : 'Chưa có tập phim'}</p><Video key={current?.slug} movie={m} episode={current} /><div className="server-selector"><label>Máy chủ phát<select value={server || ''} onChange={e => watch(episodes.find(ep => ep.server === e.target.value && ep.name === current?.name) || episodes.find(ep => ep.server === e.target.value))}>{[...new Set(episodes.map(ep => ep.server))].map(s => <option key={s}>{s}</option>)}</select></label></div><div className="player-actions"><button disabled={index <= 0} onClick={() => watch(serverEpisodes[index - 1])}>← Tập trước</button><button disabled={index < 0 || index >= serverEpisodes.length - 1} onClick={() => watch(serverEpisodes[index + 1])}>Tập tiếp →</button><Link to={'/contact?phim=' + slug}>⚑ Báo lỗi</Link><Link to={movieUrl(m)}>Thông tin phim</Link></div></> : <section className="detail-hero"><div className="detail-backdrop" style={{ backgroundImage: `url("${safeMedia(m.poster_url)}")` }} /><div className="detail-poster"><Poster movie={m} /><button className="primary-button" onClick={() => watch(current)}>▶ Xem phim</button></div><div className="detail-info"><h1>{m.name}</h1><h2>{m.origin_name} ({m.publish_year})</h2><p className="detail-tags"><span>{m.quality}</span><span>{m.language}</span><span>{m.episode_current}</span></p><p>Trạng thái: <strong>{m.status === 'completed' ? 'Hoàn tất' : m.status === 'trailer' ? 'Trailer' : 'Đang chiếu'}</strong></p><p>Thời lượng: {m.episode_time || 'Chưa cập nhật'}</p><p>Số tập: {m.episode_total || 'Chưa cập nhật'}</p><p>Quốc gia: {m.regions?.map(c => <Link key={c.slug} to={'/quoc-gia/' + c.slug}>{c.name} </Link>)}</p><p>Thể loại: {m.categories?.map(c => <Link key={c.slug} to={'/the-loai/' + c.slug}>{c.name} · </Link>)}</p><p><span className="gold">★ {m.rating_star || 'Chưa có điểm'}</span> · {number(m.view_total)} lượt xem</p><div className="detail-actions"><button onClick={() => profile('favorites')}>{user?.favorites?.includes(slug) ? '♥ Đã yêu thích' : '♡ Yêu thích'}</button><button onClick={() => profile('following')}>{user?.following?.includes(slug) ? '✓ Đang theo dõi' : '＋ Theo dõi'}</button></div></div></section>}
    <section className="panel"><h2>Danh sách tập phim</h2><p className="muted">{episodes.length} nguồn tập hiện có · Tổng số tập công bố: {m.episode_total || 'Chưa cập nhật'}</p>{[...new Set(episodes.map(e => e.server))].map(s => <div className="server-group" key={s}><h3>▣ {s}</h3><div className="episodes">{episodes.filter(e => e.server === s).sort(episodeOrder).map(e => <button className={watching && current?.slug === e.slug ? 'active' : ''} key={e.id || e.slug} onClick={() => watch(e)}>{e.name}</button>)}</div></div>)}{!episodes.length && <p>Chưa có tập phim.</p>}</section><section className="panel"><h2>Nội dung phim</h2><p>{m.description || m.content?.replace(/<[^>]+>/g, '') || 'Nội dung giới thiệu chưa được cập nhật.'}</p>{m.actor && <p>Diễn viên: {m.actor}</p>}{m.director && <p>Đạo diễn: {m.director}</p>}{m.trailer && <a className="orange" href={safeMedia(m.trailer)} target="_blank" rel="noreferrer">Xem trailer ↗</a>}</section><Community movie={m} /><section className="home-section"><h2>Có thể bạn muốn xem</h2><div className="poster-grid">{movies.filter(x => x.slug !== slug && x.categories?.some(c => m.categories?.some(t => t.slug === c.slug))).slice(0, 5).map(x => <Card movie={x} key={x.slug} />)}</div></section></div><Sidebar /></div></main>;
}
function Auth() {
  const { setUser, needsSetup, refresh, notify } = useApp();
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const history = useHistory();
  async function submit(e) {
    e.preventDefault(); setBusy(true);
    try { const body = Object.fromEntries(new FormData(e.currentTarget)); const user = await api('/auth/' + mode, 'POST', body); setUser(user); await refresh(); history.push(user.role === 'admin' ? '/admin' : '/tai-khoan'); } catch (e) { notify(e.message); } finally { setBusy(false); }
  }
  return <main className="page container"><form className="auth panel" onSubmit={submit}><h1>{mode === 'login' ? 'Đăng nhập' : mode === 'setup' ? 'Thiết lập quản trị viên' : 'Tạo tài khoản'}</h1><p className="muted">Lưu phim yêu thích, theo dõi và tiếp tục xem.</p>{mode !== 'login' && <label>Tên hiển thị<input name="name" required maxLength={80} autoComplete="name" /></label>}<label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Mật khẩu<input name="password" type="password" required minLength={8} maxLength={200} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label><button disabled={busy} className="primary-button">{busy ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</button><button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}</button>{needsSetup && <button type="button" onClick={() => setMode('setup')}>Thiết lập tài khoản Admin đầu tiên</button>}</form></main>;
}
function Account() {
  const { user, movies, setUser, notify } = useApp();
  const [tab, setTab] = useState('favorites');
  const history = useHistory();
  if (!user) return <main className="container page"><Link to="/dang-nhap">Đăng nhập để xem hồ sơ</Link></main>;
  const list = movies.filter(m => tab === 'history' ? user.history?.some(h => h.slug === m.slug) : (user[tab] || []).includes(m.slug));
  return <main className="container page"><div className="section-heading"><h1>Xin chào, {user.name}</h1>{user.role === 'admin' && <Link className="primary-button" to="/admin">Quản trị website</Link>}<button onClick={async () => { try { await api('/auth/logout', 'POST'); setUser(null); history.push('/'); } catch (e) { notify(e.message); } }}>Đăng xuất</button></div><form className="profile-form" onSubmit={async e => { e.preventDefault(); try { setUser(await api('/profile', 'POST', { field: 'name', name: new FormData(e.currentTarget).get('name') })); notify('Đã cập nhật hồ sơ.'); } catch (e) { notify(e.message); } }}><label>Tên hiển thị<input name="name" defaultValue={user.name} required maxLength={80} /></label><button>Lưu hồ sơ</button></form><div className="tabs">{[['favorites', '♥ Yêu thích'], ['history', '◷ Lịch sử xem'], ['following', '♧ Đang theo dõi']].map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div><div className="catalog-grid">{list.map(m => <div key={m.slug}><Card movie={m} />{tab === 'history' && <Link className="orange" to={'/xem-phim/' + m.slug + '?tap=' + encodeURIComponent(user.history.find(h => h.slug === m.slug).episode)}>Tiếp tục xem →</Link>}{tab === 'following' && <p className="muted">{m.episode_current} · Cập nhật {new Date(m.updated_at).toLocaleDateString('vi-VN')}</p>}</div>)}</div>{!list.length && <div className="empty">Chưa có phim trong danh sách này. <Link to="/">Khám phá phim →</Link></div>}</main>;
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
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('motchill-theme') || 'dark'; } catch { return 'dark'; } });
  const [notificationItems, setNotificationItems] = useState([]);
  const loadNotifications = React.useCallback(async () => { if (!user) { setNotificationItems([]); return; } try { setNotificationItems(await api('/notifications')); } catch { /* A session can expire while a page is open. */ } }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('motchill-theme', theme); } catch {} }, [theme]);
  useEffect(() => { loadNotifications(); const timer = setInterval(loadNotifications, 30000); return () => clearInterval(timer); }, [loadNotifications]);
  const location = useLocation();
  const notify = React.useCallback(text => setMessage(text), []);
  async function refresh() { const [data, session] = await Promise.all([api('/catalog'), api('/session')]); setCatalog(data); setUser(session.user); setNeedsSetup(session.needsSetup); setError(''); }
  useEffect(() => { refresh().catch(e => setError(e.message)); }, []);
  useEffect(() => { window.scrollTo(0, 0); document.title = 'Văn Luân | Phim mới'; }, [location.pathname]);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 5000); return () => clearTimeout(timer); }, [message]);
  if (error) return <main className="container page"><h1>Chưa kết nối được máy chủ</h1><p>{error}</p><button onClick={() => refresh().catch(e => setError(e.message))}>Thử lại</button></main>;
  if (!catalog) return <main className="container page"><h1 className="orange">VĂN LUÂN</h1><p>Đang tải danh sách phim...</p></main>;
  return <Context.Provider value={{ ...catalog, user, setUser, needsSetup, refresh, notify, theme, setTheme, notificationItems, loadNotifications }}><Header /><Switch><Route exact path="/" component={Home} /><Route path="/phim/:slug"><Detail key={location.pathname} /></Route><Route path="/xem-phim/:slug"><Detail key={location.pathname} watching /></Route><Route path={['/danh-sach/:slug', '/the-loai/:slug', '/quoc-gia/:slug', '/nam-phat-hanh/:slug', '/tim-kiem']} component={Catalog} /><Route path="/dang-nhap" component={Auth} /><Route path="/tai-khoan" component={Account} /><Route path="/thong-bao" component={Notifications} /><Route path="/admin" component={Admin} /><Route component={Info} /></Switch><RatingPeople /><Footer /><ChatBot />{message && <div className="toast" role="status">{message}<button aria-label="Đóng thông báo" onClick={() => setMessage('')}>×</button></div>}</Context.Provider>;
}
