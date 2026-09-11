import { normalize } from './api';

export const isAnimation = m => m.type === 'hoathinh' || m.categories?.some(c => ['hoat-hinh', 'anime'].includes(c.slug));
export const matchesType = (m, type) => !type || (type === 'hoathinh' ? isAnimation(m) : type === 'tvshows' ? m.type === type || m.categories?.some(c => c.slug === 'tv-shows') : m.type === type);
export const searchable = m => normalize([m.name, m.origin_name, m.description, m.actor, m.director, ...(m.categories || []).map(c => c.name)].join(' '));
export const episodeOrder = (a, b) => (a.order ?? (parseInt(String(a.name).replace(/\D/g, ''), 10) || 0)) - (b.order ?? (parseInt(String(b.name).replace(/\D/g, ''), 10) || 0));
export function subtitleTracks(episode) {
  try {
    const tracks = typeof episode?.subtitles === 'string' ? JSON.parse(episode.subtitles) : episode?.subtitles || [];
    return (Array.isArray(tracks) ? tracks : []).filter(t => /^https?:\/\//i.test(t.url || '')).map(t => ({ ...t, lang: ({ vie: 'vi', eng: 'en' }[t.lang]) || t.lang || 'vi' }));
  } catch { return []; }
}
export function recommend(movies, user) {
  const watched = new Set((user?.history || []).map(h => h.slug));
  const signals = new Set([...(user?.favorites || []), ...(user?.following || []), ...watched]);
  const genres = new Map();
  movies.filter(m => signals.has(m.slug)).forEach(m => (m.categories || []).forEach(c => genres.set(c.slug, (genres.get(c.slug) || 0) + 1)));
  const score = m => (m.categories || []).reduce((s, c) => s + (genres.get(c.slug) || 0), 0);
  return movies.filter(m => !signals.has(m.slug)).slice().sort((a, b) => score(b) - score(a) || Number(b.rating_star || 0) - Number(a.rating_star || 0));
}
export const extraTopics = [
  { name: 'Phim hot', href: '/danh-sach/phim-hot' },
  { name: 'Phim mới', href: '/danh-sach/phim-moi' },
  { name: 'Phim nổi bật', href: '/danh-sach/phim-noi-bat' },
  { name: 'Đánh giá cao', href: '/danh-sach/danh-gia-cao' },
  { name: 'Dành cho bạn', href: '/danh-sach/de-xuat' },
  { name: 'Anime', href: '/danh-sach/anime' },
  { name: 'Anime đang phát hành', href: '/danh-sach/anime?status=ongoing' },
  { name: 'Anime hoàn thành', href: '/danh-sach/anime?status=completed' },
  ...['Xuân', 'Hạ', 'Thu', 'Đông'].map((name, i) => ({ name: 'Anime mùa ' + name, href: '/danh-sach/anime?season=' + ['spring', 'summer', 'autumn', 'winter'][i] })),
];
