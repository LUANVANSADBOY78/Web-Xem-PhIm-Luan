import { episodeOrder, isAnimation, matchesType, recommend, searchable, subtitleTracks } from './discovery';
test('Imported animation can be found by type', () => {
  const movie = { type: 'series', categories: [{ slug: 'hoat-hinh' }] };
  expect(isAnimation(movie)).toBe(true);
  expect(matchesType(movie, 'hoathinh')).toBe(true);
});
test('Personal recommendations prioritize matching genres and omit watched movies', () => {
  const movies = [{ slug: 'watched', categories: [{ slug: 'drama' }] }, { slug: 'related', categories: [{ slug: 'drama' }], rating_star: 6 }, { slug: 'other', categories: [], rating_star: 10 }];
  expect(recommend(movies, { history: [{ slug: 'watched' }] }).map(m => m.slug)).toEqual(['related', 'other']);
});
test('Admin ordering takes precedence over episode numbers', () => {
  expect([{ name: '10', order: 0 }, { name: '2', order: 1 }].sort(episodeOrder)[0].name).toBe('10');
  expect([{ name: '10' }, { name: '2' }].sort(episodeOrder)[0].name).toBe('2');
});
test('Search covers Vietnamese names and actors', () => {
  expect(searchable({ name: 'Đường về', actor: 'Trần Bình' })).toContain('duong ve');
  expect(searchable({ actor: 'Trần Bình' })).toContain('tran binh');
});
test('Subtitle parsing rejects malformed content and supports imported language codes', () => {
  expect(subtitleTracks({ subtitles: 'invalid' })).toEqual([]);
  expect(subtitleTracks({ subtitles: [{ url: 'javascript:alert(1)' }] })).toEqual([]);
  expect(subtitleTracks({ subtitles: '[{"url":"https://example.test/sub.vtt","lang":"vie"}]' })[0].lang).toBe('vi');
});
