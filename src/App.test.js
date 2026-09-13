import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { api } from './api';
jest.mock('./api', () => ({ ...jest.requireActual('./api'), api: jest.fn() }));
jest.mock('hls.js', () => ({ __esModule: true, default: { isSupported: () => false } }));
const movie = { slug: 'dau-xuan', name: 'Đầu Xuân Tươi Sáng', origin_name: 'The Early Spring', publish_year: 2026, type: 'series', categories: [{ slug: 'tinh-cam', name: 'Tình Cảm' }], regions: [{ slug: 'trung-quoc', name: 'Trung Quốc' }], episodes: [], is_recommended: true, status: 'completed', rating_star: 8, updated_at: '2026-09-11' };
beforeEach(() => {
  window.scrollTo = jest.fn();
  api.mockReset();
  api.mockImplementation(path => Promise.resolve(path === '/catalog' ? { movies: [movie], settings: { name: 'Motchill' }, banners: [] } : path === '/session' ? { user: null, needsSetup: true } : { comments: [], ratings: [] }));
});
test('Home renders and search accepts Vietnamese without accents', async () => {
  render(<MemoryRouter><App /></MemoryRouter>);
  await screen.findByText('MOTCHILL ĐỀ CỬ');
  fireEvent.change(screen.getByLabelText('Tìm kiếm phim'), { target: { value: 'dau xuan' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm', exact: true }));
  expect(await screen.findByRole('heading', { name: 'Tìm kiếm: dau xuan' })).toBeInTheDocument();
  expect(screen.getByText('1 phim phù hợp')).toBeInTheDocument();
});
test('Direct detail route has a useful state without episodes', async () => {
  render(<MemoryRouter initialEntries={['/phim/dau-xuan']}><App /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Đầu Xuân Tươi Sáng', level: 1 })).toBeInTheDocument();
  expect(screen.getByText('Chưa có tập phim.')).toBeInTheDocument();
});
test('Anonymous visitors cannot access Admin', async () => {
  render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Đăng nhập quản trị' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Tìm kiếm', exact: true })).not.toBeInTheDocument();
});
test('API failures show a retry screen instead of a blank page', async () => {
  api.mockRejectedValue(new Error('Mất kết nối'));
  render(<MemoryRouter><App /></MemoryRouter>);
  expect(await screen.findByText('Chưa kết nối được máy chủ')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
});
