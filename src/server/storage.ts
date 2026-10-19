import fs from 'fs';
import path from 'path';

export interface RedirectRecord {
  id: string;
  google_url: string;
  clicks: number;
  created_at?: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'redirects.json');

const DEFAULT_REDIRECTS: RedirectRecord[] = [
  { id: 'kafe-hansen', google_url: 'https://maps.app.goo.gl/kafe-hansen', clicks: 43, created_at: '2026-10-19T00:00:00.000Z' },
  { id: 'oslo-barbershop', google_url: 'https://g.page/r/oslo-barbershop/review', clicks: 128, created_at: '2026-10-19T00:00:00.000Z' },
  { id: 'bakeri-nord', google_url: 'https://maps.app.goo.gl/bakeri-nord', clicks: 15, created_at: '2026-10-19T00:00:00.000Z' },
  { id: 'yummy-time-hamar', google_url: 'https://search.google.com/local/writereview?placeid=ChIJnUHKHgDhQUYRCj2aqsdR0gk', clicks: 4, created_at: '2026-10-19T12:00:58.816812+00:00' },
  { id: 'out-of-bounds-hamar', google_url: 'https://search.google.com/local/writereview?placeid=ChIJWzdDqbLhQUYRmmYzjX0hVzg', clicks: 5, created_at: '2026-10-19T11:58:36.626737+00:00' },
  { id: 'kaiogmattis-kafe-hamar', google_url: 'https://search.google.com/local/writereview?placeid=ChIJHVOgATzhQUYR2urIdW8dWK4', clicks: 0, created_at: '2026-10-19T11:48:52.545203+00:00' },
  { id: 'olearys', google_url: 'https://search.google.com/local/writereview?placeid=ChIJS5um4zjhQUYRrvRhHYV-Aqo', clicks: 3, created_at: '2026-10-19T11:40:55.984762+00:00' },
  { id: 'nagomi-hamar', google_url: 'https://search.google.com/local/writereview?placeid=ChIJR5kS4zjhQUYRqZah9cTXFf0', clicks: 2, created_at: '2026-10-19T11:39:00.085236+00:00' },
  { id: 'peppes-pizza-hamar', google_url: 'https://search.google.com/local/writereview?placeid=ChIJIblgKDnhQUYRQqZFCL0YQWE', clicks: 2, created_at: '2026-10-19T11:36:42.250543+00:00' },
  { id: 'pizzatia-hamar', google_url: 'https://search.google.com/local/writereview?placeid=ChIJsQsu3jjhQUYRX3C5kCfJwSw', clicks: 1, created_at: '2026-10-19T11:34:50.971385+00:00' },
  { id: 'egon-hamar', google_url: 'https://search.google.com/local/writereview?placeid=ChIJR1wpdG3hQUYRRUIkp3s1y3o', clicks: 4, created_at: '2026-10-19T11:28:32.144626+00:00' },
  { id: 'hygge-hamar', google_url: 'https://search.google.com/local/writereview?placeid=ChIJUfhwCevhQUYRS2XFdctKG5M', clicks: 4, created_at: '2026-10-19T11:27:24.936869+00:00' },
  { id: 'larsen-hamar', google_url: 'https://search.google.com/local/writereview?placeid=ChIJwZGqSDnhQUYRTZypJefpIUM', clicks: 2, created_at: '2026-10-19T11:23:42.707002+00:00' },
  { id: 'il-teatro', google_url: 'https://search.google.com/local/writereview?placeid=ChIJgxzb7-XhQUYRQHdVy-g9zJM', clicks: 27, created_at: '2026-10-09T18:48:13.070972+00:00' },
  { id: 'heim-hamar', google_url: 'https://search.google.com/local/writereview?placeid=ChIJpQj2YQ7hQUYR_AcTioAVh7I', clicks: 7, created_at: '2026-10-09T18:43:10.450506+00:00' }
];

export function getRedirects(): RedirectRecord[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_REDIRECTS, null, 2), 'utf-8');
      return DEFAULT_REDIRECTS;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return DEFAULT_REDIRECTS;
  } catch (err) {
    console.error('Feil ved lesing av redirects.json:', err);
    return DEFAULT_REDIRECTS;
  }
}

export function saveRedirects(list: RedirectRecord[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Feil ved skriving til redirects.json:', err);
  }
}

export function getRedirectById(id: string, incrementClick = false): RedirectRecord | null {
  const cleanId = (id || '').trim().toLowerCase();
  const list = getRedirects();
  const index = list.findIndex(r => r.id.toLowerCase() === cleanId);
  if (index === -1) return null;

  if (incrementClick) {
    list[index].clicks = (list[index].clicks || 0) + 1;
    saveRedirects(list);
  }
  return list[index];
}

export function upsertRedirect(record: Partial<RedirectRecord> & { id: string; google_url: string }): RedirectRecord {
  const cleanId = record.id.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '');
  let url = record.google_url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  const list = getRedirects();
  const index = list.findIndex(r => r.id.toLowerCase() === cleanId);
  if (index >= 0) {
    list[index].google_url = url;
    if (record.clicks !== undefined) {
      list[index].clicks = Math.max(list[index].clicks || 0, record.clicks);
    }
    saveRedirects(list);
    return list[index];
  } else {
    const newItem: RedirectRecord = {
      id: cleanId,
      google_url: url,
      clicks: record.clicks || 0,
      created_at: record.created_at || new Date().toISOString()
    };
    list.unshift(newItem);
    saveRedirects(list);
    return newItem;
  }
}

export function syncBatchRedirects(incomingList: RedirectRecord[]): RedirectRecord[] {
  if (!Array.isArray(incomingList) || incomingList.length === 0) {
    return getRedirects();
  }
  const current = getRedirects();
  let changed = false;

  for (const item of incomingList) {
    if (!item.id || !item.google_url) continue;
    const cleanId = item.id.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '');
    let url = item.google_url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const idx = current.findIndex(r => r.id.toLowerCase() === cleanId);
    if (idx >= 0) {
      // Bevar høyeste antall klikk
      if ((item.clicks || 0) > (current[idx].clicks || 0)) {
        current[idx].clicks = item.clicks;
        changed = true;
      }
      if (current[idx].google_url !== url && url) {
        current[idx].google_url = url;
        changed = true;
      }
    } else {
      current.push({
        id: cleanId,
        google_url: url,
        clicks: item.clicks || 0,
        created_at: item.created_at || new Date().toISOString()
      });
      changed = true;
    }
  }

  if (changed) {
    saveRedirects(current);
  }
  return current;
}

export function updateRedirectIdAndUrl(oldId: string, newId: string, newUrl: string): RedirectRecord | null {
  const cleanOld = oldId.trim().toLowerCase();
  const cleanNew = newId.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '');
  let url = newUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  const list = getRedirects();
  const idx = list.findIndex(r => r.id.toLowerCase() === cleanOld);
  if (idx === -1) return null;

  list[idx].id = cleanNew;
  list[idx].google_url = url;
  saveRedirects(list);
  return list[idx];
}

export function deleteRedirect(id: string): boolean {
  const cleanId = id.trim().toLowerCase();
  const list = getRedirects();
  const filtered = list.filter(r => r.id.toLowerCase() !== cleanId);
  if (filtered.length !== list.length) {
    saveRedirects(filtered);
    return true;
  }
  return false;
}
