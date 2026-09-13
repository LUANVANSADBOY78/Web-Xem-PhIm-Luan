const zlib = require('zlib');

const MAX_ROWS = 5000;
const MAX_BYTES = 8 * 1024 * 1024;
const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
function fail(message) { throw new Error(message); }
function rowsToObjects(rows) {
  if (!rows.length) return [];
  if (rows.length > MAX_ROWS + 1) fail('Tối đa 5.000 dòng mỗi lần nhập.');
  const headers = rows[0].map(x => String(x || '').trim());
  if (headers.length > 100 || headers.some(h => !h || unsafe.has(h)) || new Set(headers).size !== headers.length) fail('Tên cột trống, trùng hoặc không hợp lệ.');
  return rows.slice(1).filter(row => row.some(x => String(x ?? '').trim())).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])));
}
function parseCsv(content) {
  if (typeof content !== 'string' || Buffer.byteLength(content) > MAX_BYTES) fail('Tệp CSV tối đa 8 MB.');
  const rows = []; let row = [], cell = '', quoted = false;
  content = content.replace(/^\uFEFF/, '');
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (quoted) {
      if (c === '"' && content[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && !cell) quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { row.push(cell); rows.push(row); row = []; cell = ''; if (c === '\r' && content[i + 1] === '\n') i++; }
    else cell += c;
    if (rows.length > MAX_ROWS + 1 || row.length > 100 || cell.length > 1000000) fail('Tệp vượt giới hạn dòng, cột hoặc ô dữ liệu.');
  }
  if (quoted) fail('Dấu ngoặc kép trong CSV chưa đóng.');
  if (cell || row.length) rows.push([...row, cell]);
  return rowsToObjects(rows);
}
const textValue = value => value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
function csv(rows) {
  const headers = [...new Set(rows.flatMap(Object.keys))];
  const escape = value => '"' + textValue(value).replace(/^[=+@\-\t\r]/, x => "'" + x).replace(/"/g, '""') + '"';
  return '\uFEFF' + [headers, ...rows.map(row => headers.map(h => row[h]))].map(row => row.map(escape).join(',')).join('\r\n');
}
const unxml = value => String(value || '').replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => { const cp = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n); return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ''; }).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const xml = value => textValue(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
function unzip(buffer) {
  if (buffer.length > MAX_BYTES) fail('Tệp Excel tối đa 8 MB.');
  let end = -1;
  for (let p = buffer.length - 22; p >= Math.max(0, buffer.length - 65557); p--) if (buffer.readUInt32LE(p) === 0x06054b50) { end = p; break; }
  if (end < 0 || buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6)) fail('Tệp XLSX không hợp lệ.');
  const count = buffer.readUInt16LE(end + 10); let p = buffer.readUInt32LE(end + 16), bytes = 0;
  if (count > 2000) fail('Tệp Excel có quá nhiều thành phần.');
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (p + 46 > buffer.length || buffer.readUInt32LE(p) !== 0x02014b50) fail('Mục lục XLSX không hợp lệ.');
    const flags = buffer.readUInt16LE(p + 8), method = buffer.readUInt16LE(p + 10), compressed = buffer.readUInt32LE(p + 20), size = buffer.readUInt32LE(p + 24), nl = buffer.readUInt16LE(p + 28), extra = buffer.readUInt16LE(p + 30), comment = buffer.readUInt16LE(p + 32), offset = buffer.readUInt32LE(p + 42);
    const name = buffer.subarray(p + 46, p + 46 + nl).toString('utf8'); p += 46 + nl + extra + comment; bytes += size;
    if (flags & 1 || ![0, 8].includes(method) || bytes > 30 * 1024 * 1024 || size > 20 * 1024 * 1024 || name.includes('..') || name.startsWith('/')) fail('Thành phần XLSX không được hỗ trợ hoặc vượt giới hạn.');
    if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50) fail('Dữ liệu XLSX bị lỗi.');
    const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    if (start + compressed > buffer.length) fail('Dữ liệu XLSX không đầy đủ.');
    if (!name.endsWith('.xml') && !name.endsWith('.rels')) continue;
    const data = method === 8 ? zlib.inflateRawSync(buffer.subarray(start, start + compressed), { maxOutputLength: Math.max(1, size) }) : buffer.subarray(start, start + compressed);
    if (data.length !== size) fail('Kích thước XLSX không hợp lệ.');
    const value = data.toString('utf8');
    if (/<!DOCTYPE|<!ENTITY/i.test(value)) fail('Không hỗ trợ XML chứa DTD hoặc entity ngoài.');
    files.set(name, value);
  }
  return files;
}
function parseXlsx(content) {
  if (typeof content !== 'string' || content.length > MAX_BYTES * 1.4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(content)) fail('Nội dung Excel phải là base64 hợp lệ.');
  const files = unzip(Buffer.from(content, 'base64'));
  const workbook = files.get('xl/workbook.xml') || '';
  const firstId = workbook.match(/<sheet\b[^>]*\br:id=["']([^"']+)/)?.[1];
  let sheetPath = 'xl/worksheets/sheet1.xml';
  if (firstId) for (const rel of (files.get('xl/_rels/workbook.xml.rels') || '').matchAll(/<Relationship\b[^>]*\/>/g)) {
    if (rel[0].match(/\bId=["']([^"']+)/)?.[1] === firstId) {
      const target = rel[0].match(/\bTarget=["']([^"']+)/)?.[1] || '';
      if (/TargetMode=["']External/i.test(rel[0]) || target.includes('..')) fail('Không đọc nguồn Excel bên ngoài.');
      sheetPath = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
    }
  }
  const sheet = files.get(sheetPath);
  if (!sheet) fail('Không tìm thấy trang tính đầu tiên.');
  const strings = [...(files.get('xl/sharedStrings.xml') || '').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t => unxml(t[1])).join(''));
  const rows = [];
  for (const r of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = c[1].match(/\br=["']([A-Z]+)/)?.[1];
      const index = ref ? [...ref].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0) - 1 : row.length;
      if (index >= 100) fail('Tối đa 100 cột.');
      const kind = c[1].match(/\bt=["']([^"']+)/)?.[1]; const body = c[2] || '';
      if (/<f\b/i.test(body)) fail('Vui lòng chuyển công thức Excel thành giá trị trước khi nhập.');
      const raw = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] || '';
      row[index] = kind === 's' ? strings[Number(raw)] || '' : kind === 'inlineStr' ? [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t => unxml(t[1])).join('') : unxml(raw);
    }
    rows.push(Array.from({ length: row.length }, (_, i) => row[i] ?? ''));
    if (rows.length > MAX_ROWS + 1) fail('Tối đa 5.000 dòng mỗi lần nhập.');
  }
  return rowsToObjects(rows);
}
function crc32(buffer) { let crc = 0xffffffff; for (const byte of buffer) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function zip(files) {
  const local = [], central = []; let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const n = Buffer.from(name), data = Buffer.from(text), crc = crc32(data), header = Buffer.alloc(30), entry = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(n.length, 26);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(data.length, 20); entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(n.length, 28); entry.writeUInt32LE(offset, 42);
    local.push(header, n, data); central.push(entry, n); offset += header.length + n.length + data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22), count = Object.keys(files).length;
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
function xlsx(rows) {
  if (rows.length > MAX_ROWS) fail('Tối đa 5.000 dòng khi xuất Excel.');
  const headers = [...new Set(rows.flatMap(Object.keys))];
  const column = index => { let s = ''; for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
  const sheet = [headers, ...rows.map(row => headers.map(h => row[h]))].map((row, i) => `<row r="${i + 1}">${row.map((value, j) => `<c r="${column(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`).join('')}</row>`).join('');
  return zip({
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet}</sheetData></worksheet>`,
  });
}
module.exports = { parseCsv, parseXlsx, csv, xlsx, MAX_ROWS };
