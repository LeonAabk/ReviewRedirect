/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Link2,
  QrCode as QrIcon,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  Database,
  FileCode,
  Smartphone,
  Sliders,
  Sparkles,
  ArrowRight,
  Eye,
  Download,
  GitBranch,
  Terminal,
  HelpCircle,
  Globe
} from 'lucide-react';

interface RedirectItem {
  id: string;
  google_url: string;
  clicks: number;
  created_at?: string;
}

interface SupabaseConfig {
  url: string;
  key: string;
  customDomain: string;
}

const DEFAULT_SQL = `-- =====================================================
-- 1. OPPRETT TABELL FOR DYNAMISK OMDIRIGERING
-- =====================================================
create table if not exists public.redirects (
  id text primary key,
  google_url text not null,
  clicks bigint default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =====================================================
-- 2. AKTIVER ROW LEVEL SECURITY (RLS)
-- =====================================================
alter table public.redirects enable row level security;

-- =====================================================
-- 3. TILGANGSREGLER (POLICIES)
-- =====================================================
-- Tillat offentlig lesing (brukes av r.html og admin.html)
create policy "Allow public read" on public.redirects
  for select using (true);

-- Tillat offentlig opprettelse av nye lenker
create policy "Allow public insert" on public.redirects
  for insert with check (true);

-- Tillat inkrementering av klikkteller
create policy "Allow public update" on public.redirects
  for update using (true);

-- Tillat sletting fra adminpanelet
create policy "Allow public delete" on public.redirects
  for delete using (true);`;

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'files' | 'nfc' | 'supabase' | 'github'>('dashboard');
  const [ghUser, setGhUser] = useState('ditt-brukernavn');
  const [ghRepo, setGhRepo] = useState('nfc-redirect');
  const [redirects, setRedirects] = useState<RedirectItem[]>([]);
  const [slugInput, setSlugInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCopiedId, setIsCopiedId] = useState<string | null>(null);
  const [selectedForCard, setSelectedForCard] = useState<RedirectItem | null>(null);
  const [cardQrDataUrl, setCardQrDataUrl] = useState<string>('');
  const [isSimulatingNfc, setIsSimulatingNfc] = useState(false);

  // Supabase konfigurasjon
  const [config, setConfig] = useState<SupabaseConfig>({
    url: 'https://eqdxlbhupyvvfhoomliu.supabase.co',
    key: 'sb_publishable_o7wt9THRQ8XQ2JNnw0a-Bg_aV4dWz9A',
    customDomain: ''
  });
  const [isConnectedToSupabase, setIsConnectedToSupabase] = useState(true);
  const [selectedFileView, setSelectedFileView] = useState<'r.html' | 'admin.html'>('r.html');

  // Last initielle data
  useEffect(() => {
    // Last config
    try {
      const storedConfig = localStorage.getItem('supabase_config');
      const customDomain = localStorage.getItem('custom_domain') || '';
      if (storedConfig) {
        const parsed = JSON.parse(storedConfig);
        setConfig({
          url: parsed.url || 'https://eqdxlbhupyvvfhoomliu.supabase.co',
          key: parsed.key || 'sb_publishable_o7wt9THRQ8XQ2JNnw0a-Bg_aV4dWz9A',
          customDomain: customDomain || ''
        });
      }
    } catch (e) {
      console.error(e);
    }

    // Last redirects
    try {
      const storedRedirects = localStorage.getItem('mock_redirects');
      if (storedRedirects) {
        const parsed = JSON.parse(storedRedirects);
        setRedirects(parsed);
        if (parsed.length > 0) setSelectedForCard(parsed[0]);
      } else {
        const initial = [
          {
            id: 'kafe-hansen',
            google_url: 'https://g.page/r/kafe-hansen/review',
            clicks: 48,
            created_at: new Date(Date.now() - 86400000 * 4).toISOString()
          },
          {
            id: 'oslo-barbershop',
            google_url: 'https://maps.app.goo.gl/oslo-barbershop',
            clicks: 132,
            created_at: new Date(Date.now() - 86400000 * 2).toISOString()
          },
          {
            id: 'bakeri-nord',
            google_url: 'https://g.page/r/bakeri-nord/review',
            clicks: 19,
            created_at: new Date(Date.now() - 86400000 * 1).toISOString()
          }
        ];
        setRedirects(initial);
        localStorage.setItem('mock_redirects', JSON.stringify(initial));
        setSelectedForCard(initial[0]);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Generer QR-kode når selectedForCard endrer seg
  useEffect(() => {
    if (selectedForCard) {
      const targetUrl = buildFullUrl(selectedForCard.id);
      QRCode.toDataURL(targetUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      }).then(dataUri => {
        setCardQrDataUrl(dataUri);
      }).catch(err => {
        console.error('QR code generation error:', err);
      });
    }
  }, [selectedForCard, config.customDomain]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const buildFullUrl = (id: string) => {
    if (config.customDomain && config.customDomain.trim() !== '') {
      let clean = config.customDomain.trim().replace(/\/$/, '');
      if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = 'https://' + clean;
      }
      return `${clean}/r.html?id=${encodeURIComponent(id)}`;
    }
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname || '/';
      const dir = pathname.substring(0, pathname.lastIndexOf('/') + 1);
      return `${window.location.origin}${dir}r.html?id=${encodeURIComponent(id)}`;
    }
    return `https://dittdomene.no/r.html?id=${encodeURIComponent(id)}`;
  };

  const handleSaveRedirect = (e: React.FormEvent) => {
    e.preventDefault();
    let slug = slugInput.trim().toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_]/g, '');

    let url = urlInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    if (!slug) {
      showToast('Kunde-ID / slug kan ikke være tom');
      return;
    }

    const existingIdx = redirects.findIndex(r => r.id === slug);
    let updated: RedirectItem[];

    if (existingIdx >= 0) {
      updated = [...redirects];
      updated[existingIdx] = {
        ...updated[existingIdx],
        google_url: url
      };
      showToast(`Oppdaterte lenke for "${slug}"`);
    } else {
      const newItem: RedirectItem = {
        id: slug,
        google_url: url,
        clicks: 0,
        created_at: new Date().toISOString()
      };
      updated = [newItem, ...redirects];
      showToast(`Opprettet ny omdirigering for "${slug}"`);
      setSelectedForCard(newItem);
    }

    setRedirects(updated);
    try {
      localStorage.setItem('mock_redirects', JSON.stringify(updated));
    } catch (e) {}

    setSlugInput('');
    setUrlInput('');
  };

  const handleDelete = (id: string) => {
    if (confirm(`Er du sikker på at du vil slette omdirigeringen for "${id}"?`)) {
      const updated = redirects.filter(r => r.id !== id);
      setRedirects(updated);
      try {
        localStorage.setItem('mock_redirects', JSON.stringify(updated));
      } catch (e) {}
      if (selectedForCard?.id === id) {
        setSelectedForCard(updated[0] || null);
      }
      showToast(`Slettet "${id}"`);
    }
  };

  const handleCopyLink = (id: string) => {
    const url = buildFullUrl(id);
    navigator.clipboard.writeText(url).then(() => {
      setIsCopiedId(id);
      showToast(`Kopierte: ${url}`);
      setTimeout(() => setIsCopiedId(null), 2000);
    });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (config.url && config.key) {
      localStorage.setItem('supabase_config', JSON.stringify({ url: config.url, key: config.key }));
      setIsConnectedToSupabase(true);
    } else {
      localStorage.removeItem('supabase_config');
      setIsConnectedToSupabase(false);
    }
    if (config.customDomain) {
      localStorage.setItem('custom_domain', config.customDomain);
    } else {
      localStorage.removeItem('custom_domain');
    }
    showToast('Innstillinger lagret!');
  };

  const simulateNfcTap = () => {
    if (!selectedForCard) return;
    setIsSimulatingNfc(true);
    setTimeout(() => {
      // Inkrementer klikk
      const updated = redirects.map(item => {
        if (item.id === selectedForCard.id) {
          return { ...item, clicks: item.clicks + 1 };
        }
        return item;
      });
      setRedirects(updated);
      setSelectedForCard({ ...selectedForCard, clicks: selectedForCard.clicks + 1 });
      try {
        localStorage.setItem('mock_redirects', JSON.stringify(updated));
      } catch (e) {}
      setIsSimulatingNfc(false);
      showToast(`NFC-kort registrert! Videresender til: ${selectedForCard.google_url}`);
      window.open(selectedForCard.google_url, '_blank');
    }, 700);
  };

  const filteredRedirects = redirects.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return item.id.toLowerCase().includes(term) || item.google_url.toLowerCase().includes(term);
  });

  const totalClicks = redirects.reduce((sum, item) => sum + (item.clicks || 0), 0);
  const mostPopular = [...redirects].sort((a, b) => b.clicks - a.clicks)[0];

  // Generer kildekoden til filene med de fylte inn Supabase-verdiene
  const getRHtmlCode = () => {
    const url = config.url || 'https://DITT-PROSJEKT.supabase.co';
    const key = config.key || 'DIN-ANON-KEY-HER';

    return `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Videresender...</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"><\/script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #0f172a;
      color: #f8fafc;
      padding: 1.5rem;
    }
    .loader-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.25rem;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3px solid rgba(255, 255, 255, 0.15);
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status-text { font-size: 0.95rem; color: #94a3b8; }
    .error-card {
      display: none;
      max-width: 440px;
      width: 100%;
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 2.25rem 2rem;
      text-align: center;
    }
    .error-icon {
      width: 50px;
      height: 50px;
      margin: 0 auto 1.25rem;
      border-radius: 50%;
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      font-weight: 700;
    }
    .error-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
    .error-desc { font-size: 0.95rem; color: #94a3b8; line-height: 1.5; margin-bottom: 1.5rem; }
    .error-badge { display: inline-block; font-family: monospace; background: #0f172a; padding: 0.25rem 0.6rem; border-radius: 6px; }
  </style>
</head>
<body>
  <div id="loader" class="loader-container">
    <div class="spinner"></div>
    <div class="status-text">Kobler til omdirigering...</div>
  </div>

  <div id="error-card" class="error-card">
    <div class="error-icon">!</div>
    <h1 class="error-title" id="error-title">Ugyldig lenke</h1>
    <p class="error-desc" id="error-desc">Denne NFC- eller QR-koden er ikke registrert eller har utløpt.</p>
  </div>

  <script>
    // ==========================================
    // SUPABASE KONFIGURASJON
    // ==========================================
    const SUPABASE_URL = '${url}';
    const SUPABASE_ANON_KEY = '${key}';
    // ==========================================

    async function executeRedirect() {
      const urlParams = new URLSearchParams(window.location.search);
      const redirectId = urlParams.get('id');

      if (!redirectId) {
        showError('Mangler Kunde-ID', 'Ingen gyldig parameter ble funnet i nettadressen.');
        return;
      }

      if (!SUPABASE_URL || SUPABASE_URL.includes('DITT-PROSJEKT')) {
        showError('Supabase ikke konfigurert', 'Fyll inn SUPABASE_URL og SUPABASE_ANON_KEY i filen.');
        return;
      }

      const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      try {
        const { data, error } = await client
          .from('redirects')
          .select('id, google_url, clicks')
          .eq('id', redirectId)
          .maybeSingle();

        if (error || !data) {
          showError('Ugyldig lenke', 'Fant ingen omdirigering for ID: <br><span class="error-badge">' + redirectId + '</span>');
          return;
        }

        // Inkrementer klikk
        try {
          await client
            .from('redirects')
            .update({ clicks: (data.clicks || 0) + 1 })
            .eq('id', redirectId);
        } catch (e) {
          console.warn('Klikkoppdatering feilet:', e);
        }

        // Omdiriger
        let target = data.google_url.trim();
        if (!target.startsWith('http://') && !target.startsWith('https://')) {
          target = 'https://' + target;
        }
        window.location.replace(target);

      } catch (err) {
        showError('Systemfeil', 'Det oppstod en feil under omdirigering.');
      }
    }

    function showError(title, msg) {
      document.getElementById('loader').style.display = 'none';
      const card = document.getElementById('error-card');
      card.style.display = 'block';
      document.getElementById('error-title').textContent = title;
      document.getElementById('error-desc').innerHTML = msg;
    }

    document.addEventListener('DOMContentLoaded', executeRedirect);
  <\/script>
</body>
</html>`;
  };

  const getAdminHtmlCode = () => {
    const url = config.url || 'https://DITT-PROSJEKT.supabase.co';
    const key = config.key || 'DIN-ANON-KEY-HER';

    return `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard · NFC & QR Omdirigering</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #090d16;
      color: #f8fafc;
      font-family: 'Plus Jakarta Sans', sans-serif;
      padding: 2rem 1.5rem;
    }
    .container { max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 2rem; }
    .card { background: #111827; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 1.5rem; }
    .title { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
    .desc { font-size: 0.85rem; color: #94a3b8; margin-bottom: 1.25rem; }
    .form-grid { display: grid; grid-template-columns: 1fr 1.6fr auto; gap: 1rem; align-items: flex-end; }
    @media(max-width: 768px) { .form-grid { grid-template-columns: 1fr; } }
    .input-box label { font-size: 0.825rem; font-weight: 600; color: #cbd5e1; display: block; margin-bottom: 0.4rem; }
    .input-box input {
      width: 100%; background: #0b1120; border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px; padding: 0.75rem; color: #fff; font-size: 0.9rem;
    }
    .btn-save {
      background: #0284c7; color: #fff; border: none; border-radius: 8px;
      padding: 0.75rem 1.5rem; font-weight: 600; cursor: pointer; height: 44px;
    }
    .btn-save:hover { background: #0369a1; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th { text-align: left; padding: 0.75rem 1rem; font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; background: #0b1120; }
    td { padding: 0.85rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.875rem; }
    .mono { font-family: 'JetBrains Mono', monospace; color: #38bdf8; }
    .btn-action {
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
      color: #e2e8f0; border-radius: 6px; padding: 0.35rem 0.65rem; font-size: 0.8rem; cursor: pointer; margin-left: 0.35rem;
    }
    .btn-action:hover { background: rgba(255,255,255,0.12); }
    .btn-delete { color: #f87171; }
    .btn-delete:hover { background: rgba(239,68,68,0.2); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1 class="title">NFC & QR Omdirigerings-Dashboard</h1>
      <p class="desc">Administrer bedrifter, Google Reviews og spor klikk via Supabase.</p>
    </header>

    <div class="card">
      <h2 style="font-size: 1rem; margin-bottom: 0.75rem;">Legg til ny bedrift</h2>
      <form id="form" onsubmit="saveRedirect(event)" class="form-grid">
        <div class="input-box">
          <label>Kunde-ID / Slug (f.eks. kafe-hansen)</label>
          <input type="text" id="slug" placeholder="kafe-hansen" required class="mono">
        </div>
        <div class="input-box">
          <label>Google Review URL</label>
          <input type="url" id="url" placeholder="https://g.page/r/kafe-hansen/review" required>
        </div>
        <button type="submit" class="btn-save">Lagre</button>
      </form>
    </div>

    <div class="card">
      <h2 style="font-size: 1rem;">Registrerte omdirigeringer</h2>
      <table>
        <thead>
          <tr>
            <th>Kunde-ID</th>
            <th>Destinasjonslenke</th>
            <th style="text-align: right;">Antall klikk</th>
            <th style="text-align: right;">Handlinger</th>
          </tr>
        </thead>
        <tbody id="table-body"></tbody>
      </table>
    </div>
  </div>

  <script>
    // ==========================================
    // SUPABASE KONFIGURASJON
    // ==========================================
    const SUPABASE_URL = '${url}';
    const SUPABASE_ANON_KEY = '${key}';
    // ==========================================

    const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    async function loadRedirects() {
      const { data, error } = await client.from('redirects').select('*').order('created_at', { ascending: false });
      const tbody = document.getElementById('table-body');
      if (error || !data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:2rem;">Ingen oppføringer funnet.</td></tr>';
        return;
      }
      tbody.innerHTML = data.map(r => \`
        <tr>
          <td class="mono">\${r.id}</td>
          <td><a href="\${r.google_url}" target="_blank" style="color:#94a3b8;">\${r.google_url}</a></td>
          <td style="text-align:right; font-family:monospace; font-weight:600;">\${r.clicks || 0}</td>
          <td style="text-align:right;">
            <button class="btn-action" onclick="copyLink('\${r.id}')">Kopier lenke</button>
            <button class="btn-action btn-delete" onclick="deleteItem('\${r.id}')">Slett</button>
          </td>
        </tr>
      \`).join('');
    }

    async function saveRedirect(e) {
      e.preventDefault();
      const id = document.getElementById('slug').value.trim().toLowerCase().replace(/\\s+/g, '-');
      const google_url = document.getElementById('url').value.trim();
      await client.from('redirects').upsert({ id, google_url }, { onConflict: 'id' });
      document.getElementById('slug').value = '';
      document.getElementById('url').value = '';
      loadRedirects();
    }

    async function deleteItem(id) {
      if (confirm('Slette omdirigering for ' + id + '?')) {
        await client.from('redirects').delete().eq('id', id);
        loadRedirects();
      }
    }

    function copyLink(id) {
      const full = window.location.origin + '/r.html?id=' + encodeURIComponent(id);
      navigator.clipboard.writeText(full);
      alert('Kopierte: ' + full);
    }

    document.addEventListener('DOMContentLoaded', loadRedirects);
  <\/script>
</body>
</html>`;
  };

  const downloadFile = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Lastet ned ${fileName}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-sky-600 text-white px-5 py-3 rounded-lg shadow-xl font-medium text-sm flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-lg border border-sky-500/30">
              ⚡
            </div>
            <div>
              <h1 className="font-bold text-slate-100 text-base sm:text-lg leading-tight tracking-tight">
                NFC & QR Redirect Engine
              </h1>
              <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>Supabase Dynamic Routing</span>
                <span>·</span>
                <span className={isConnectedToSupabase ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                  {isConnectedToSupabase ? 'Tilkoblet Supabase' : 'Lokal demomodus'}
                </span>
              </div>
            </div>
          </div>

          {/* Navigasjon */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('nfc')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'nfc'
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              NFC & QR Generator
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'files'
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Filer (r.html & admin.html)
            </button>
            <button
              onClick={() => setActiveTab('supabase')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'supabase'
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Supabase SQL Setup
            </button>
            <button
              onClick={() => setActiveTab('github')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'github'
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              GitHub & Pages
            </button>
          </nav>
        </div>
      </header>

      {/* Hovedinnhold */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Quick Action Bar / Live test lenker */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-xs sm:text-sm text-slate-300 font-medium">
                  Begge filene er generert og aktive på serveren:
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/admin.html"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-sky-400 border border-slate-700 transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Åpne admin.html
                </a>
                <a
                  href="/r.html?id=kafe-hansen"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Test r.html?id=kafe-hansen
                </a>
              </div>
            </div>

            {/* Statistikk-oversikt */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Aktive Omdirigeringer</div>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1 tabular-nums">
                  {redirects.length}
                </div>
                <div className="text-xs text-slate-500 mt-2">Knyttet til NFC & QR-koder</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Totale Omdirigeringer / Klikk</div>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-sky-400 mt-1 tabular-nums">
                  {totalClicks}
                </div>
                <div className="text-xs text-slate-500 mt-2">Registrert automatisk i Supabase</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Mest Populære Bedrift</div>
                <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400 mt-1 truncate">
                  {mostPopular ? `${mostPopular.id} (${mostPopular.clicks})` : '-'}
                </div>
                <div className="text-xs text-slate-500 mt-2">Flest Google Review-taps</div>
              </div>
            </div>

            {/* Skjema for å legge til nye bedrifter */}
            <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <Plus className="w-5 h-5 text-sky-400" />
                  Legg til ny bedrift / omdirigering
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Knytt en unik NFC/QR-slug (f.eks. <code className="text-sky-300">kafe-hansen</code>) til kundens offisielle Google Review-adresse.
                </p>
              </div>

              <form onSubmit={handleSaveRedirect} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-4">
                  <label htmlFor="form-slug" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Kunde-ID / Slug (f.eks. kafe-hansen)
                  </label>
                  <input
                    id="form-slug"
                    type="text"
                    value={slugInput}
                    onChange={(e) => setSlugInput(e.target.value)}
                    placeholder="kafe-hansen"
                    required
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition"
                  />
                </div>

                <div className="md:col-span-6">
                  <label htmlFor="form-url" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Google Review URL (eller destinasjonslenke)
                  </label>
                  <input
                    id="form-url"
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://g.page/r/kafe-hansen/review"
                    required
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition"
                  />
                </div>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="w-full h-[42px] bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    Lagre
                  </button>
                </div>
              </form>
            </section>

            {/* Tabell over omdirigeringer */}
            <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Registrerte omdirigeringer i Supabase
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                    Oversikt over alle aktive koder, destinasjoner og klikk-teller.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Søk i ID eller lenke..."
                      className="bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 w-56 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Tabell */}
              <div className="overflow-x-auto border border-slate-800/80 rounded-xl">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-950/70 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-4">Kunde-ID (Slug)</th>
                      <th className="py-3 px-4">Destinasjonslenke</th>
                      <th className="py-3 px-4 text-right">Antall klikk</th>
                      <th className="py-3 px-4 text-right">Handlinger</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredRedirects.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">
                          Ingen omdirigeringer funnet. Legg til en over!
                        </td>
                      </tr>
                    ) : (
                      filteredRedirects.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-medium text-sky-400 text-sm">
                            {item.id}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs sm:max-w-md truncate text-slate-300">
                            <a
                              href={item.google_url}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-white hover:underline flex items-center gap-1.5 text-xs text-slate-300"
                            >
                              <span className="truncate">{item.google_url}</span>
                              <ExternalLink className="w-3 h-3 shrink-0 text-slate-500" />
                            </a>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-white tabular-nums">
                            {item.clicks || 0}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => handleCopyLink(item.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
                              title="Kopier omdirigeringsadresse"
                            >
                              {isCopiedId === item.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400">Kopiert!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Kopier lenke</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => {
                                setSelectedForCard(item);
                                setActiveTab('nfc');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-purple-300 border border-slate-700 transition"
                              title="Generer NFC & QR-kort"
                            >
                              <QrIcon className="w-3.5 h-3.5" />
                              <span>QR-kort</span>
                            </button>

                            <a
                              href={`/r.html?id=${encodeURIComponent(item.id)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-sky-300 border border-slate-700 transition"
                              title="Test omdirigering nå"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Test</span>
                            </a>

                            <button
                              onClick={() => handleDelete(item.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-red-950/40 text-xs font-medium text-red-400 border border-slate-700 hover:border-red-800 transition"
                              title="Slett oppføring"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Slett</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: NFC & QR CARD GENERATOR */}
        {activeTab === 'nfc' && (
          <div className="space-y-8">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-sky-400" />
                    NFC-Kort & Borddisplay Generator
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Forhåndsvis det fysiske NFC-kortet eller borddisplayet for en valgt bedrift, test virtuell NFC-berøring, eller last ned QR-koden for trykk.
                  </p>
                </div>

                {/* Velg bedrift */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-400">Velg bedrift:</label>
                  <select
                    value={selectedForCard?.id || ''}
                    onChange={(e) => {
                      const found = redirects.find(r => r.id === e.target.value);
                      if (found) setSelectedForCard(found);
                    }}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
                  >
                    {redirects.map(r => (
                      <option key={r.id} value={r.id}>{r.id} ({r.clicks} klikk)</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedForCard ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  {/* Fysisk Kort-Mockup */}
                  <div className="lg:col-span-7 flex justify-center">
                    <div className="relative w-full max-w-md aspect-[1.586/1] rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 border border-slate-700/80 p-6 shadow-2xl flex flex-col justify-between overflow-hidden">
                      {/* Bakgrunnsdekor */}
                      <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
                      <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl pointer-events-none"></div>

                      {/* Topp på kort */}
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-white text-sm border border-white/20">
                            ★
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                              Gi oss en anmeldelse
                            </div>
                            <div className="text-sm font-bold text-white capitalize">
                              {selectedForCard.id.replace(/-/g, ' ')}
                            </div>
                          </div>
                        </div>

                        {/* NFC Brikke-ikon */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 text-xs font-medium">
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>NFC Tap</span>
                        </div>
                      </div>

                      {/* Midtparti med QR-kode */}
                      <div className="relative z-10 flex items-center justify-between my-2">
                        <div className="space-y-2 max-w-[200px]">
                          <div className="text-xs text-slate-300 leading-relaxed">
                            Hold telefonen inntil kortet eller skann QR-koden for å gi din vurdering på Google.
                          </div>
                          <div className="text-[11px] font-mono text-sky-400 break-all bg-black/40 px-2 py-1 rounded border border-white/5">
                            ?id={selectedForCard.id}
                          </div>
                        </div>

                        {cardQrDataUrl && (
                          <div className="bg-white p-2 rounded-xl shadow-lg border border-slate-200">
                            <img src={cardQrDataUrl} alt="QR Kode" className="w-24 h-24 sm:w-28 sm:h-28" />
                          </div>
                        )}
                      </div>

                      {/* Bunn på kort */}
                      <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/10">
                        <span>Google Reviews Direct</span>
                        <span className="font-mono tabular-nums">{selectedForCard.clicks} anmeldelses-taps</span>
                      </div>
                    </div>
                  </div>

                  {/* Handlinger for kort */}
                  <div className="lg:col-span-5 space-y-5">
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="text-xs uppercase font-semibold tracking-wider text-slate-400">
                        Aktiv Omdirigerings-URL
                      </div>
                      <div className="font-mono text-xs text-sky-400 bg-slate-900 p-2.5 rounded-lg border border-slate-800 break-all">
                        {buildFullUrl(selectedForCard.id)}
                      </div>
                      <div className="text-xs text-slate-400">
                        Mål: <span className="text-slate-200 break-all">{selectedForCard.google_url}</span>
                      </div>
                    </div>

                    {/* Simuleringsknapp */}
                    <div className="space-y-3">
                      <button
                        onClick={simulateNfcTap}
                        disabled={isSimulatingNfc}
                        className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 disabled:opacity-50"
                      >
                        <Smartphone className="w-5 h-5 animate-pulse" />
                        {isSimulatingNfc ? 'Registrerer NFC Tap...' : 'Simuler Telefon Tap på NFC-Kort'}
                      </button>

                      <div className="grid grid-cols-2 gap-3">
                        {cardQrDataUrl && (
                          <a
                            href={cardQrDataUrl}
                            download={`qr-${selectedForCard.id}.png`}
                            className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Last ned QR (PNG)
                          </a>
                        )}
                        <button
                          onClick={() => handleCopyLink(selectedForCard.id)}
                          className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Kopier NFC-URL
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  Ingen bedrifter registrert ennå. Opprett en i Dashboard!
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: GENERERTE FILER (r.html & admin.html) */}
        {activeTab === 'files' && (
          <div className="space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-sky-400" />
                    Kildekode for filene
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Både <code className="text-sky-300">r.html</code> og <code className="text-sky-300">admin.html</code> er fullt selvstendige, rene HTML-filer med Supabase JS CDN.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedFileView('r.html')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      selectedFileView === 'r.html'
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    r.html (Redirect)
                  </button>
                  <button
                    onClick={() => setSelectedFileView('admin.html')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      selectedFileView === 'admin.html'
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    admin.html (Dashboard)
                  </button>
                </div>
              </div>

              {/* Toolbar for kildekode */}
              <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="text-xs font-mono text-slate-400">
                  Fil: <span className="text-sky-400 font-bold">{selectedFileView}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const code = selectedFileView === 'r.html' ? getRHtmlCode() : getAdminHtmlCode();
                      navigator.clipboard.writeText(code);
                      showToast(`Kopierte ${selectedFileView} til utklippstavlen!`);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Kopier kildekode
                  </button>
                  <button
                    onClick={() => {
                      const code = selectedFileView === 'r.html' ? getRHtmlCode() : getAdminHtmlCode();
                      downloadFile(selectedFileView, code);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Last ned fil
                  </button>
                </div>
              </div>

              {/* Kodevisning */}
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-[500px] leading-relaxed">
                <code>{selectedFileView === 'r.html' ? getRHtmlCode() : getAdminHtmlCode()}</code>
              </pre>
            </div>
          </div>
        )}

        {/* TAB 4: SUPABASE SQL SETUP & INNSTILLINGER */}
        {activeTab === 'supabase' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* SQL Guide */}
            <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-sky-400" />
                  Supabase Database Setup
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Kjør dette skriptet i <strong>Supabase SQL Editor</strong> for å opprette tabellen og åpne riktige tilgangsregler (RLS).
                </p>
              </div>

              <div className="relative">
                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-sky-300 overflow-x-auto max-h-[400px] leading-relaxed">
                  <code>{DEFAULT_SQL}</code>
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(DEFAULT_SQL);
                    showToast('SQL-skript kopiert!');
                  }}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-sky-600/90 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Kopier SQL
                </button>
              </div>

              <div className="space-y-3 pt-2">
                <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Trinn for trinn:
                </div>
                <ol className="list-decimal list-inside text-xs text-slate-400 space-y-2">
                  <li>Logg inn på <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">Supabase</a> og opprett et nytt prosjekt.</li>
                  <li>Gå til <strong>SQL Editor</strong> i venstremenyen og lim inn koden over.</li>
                  <li>Klikk <strong>Run</strong> for å opprette <code className="text-sky-300">redirects</code>-tabellen.</li>
                  <li>Gå til <strong>Project Settings → API</strong> for å hente din <strong>Project URL</strong> og <strong>anon public key</strong>.</li>
                  <li>Fyll inn nøklene i skjemaet til høyre eller øverst i script-delen i filene!</li>
                </ol>
              </div>
            </div>

            {/* Supabase Nøkkel-konfigurasjon */}
            <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-sky-400" />
                  Supabase Nøkler & Innstillinger
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Lagre nøklene her for å koble denne applikasjonen og forhåndsvisningen direkte til din Supabase-database.
                </p>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Supabase Prosjekt URL
                  </label>
                  <input
                    type="text"
                    value={config.url}
                    onChange={(e) => setConfig({ ...config, url: e.target.value })}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Supabase Anon Public Key
                  </label>
                  <input
                    type="password"
                    value={config.key}
                    onChange={(e) => setConfig({ ...config, key: e.target.value })}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Eget Domenenavn (valgfritt)
                  </label>
                  <input
                    type="text"
                    value={config.customDomain}
                    onChange={(e) => setConfig({ ...config, customDomain: e.target.value })}
                    placeholder="f.eks. mittdomene.no (lar stå tomt for aktivt domene)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Brukt ved kopiering av lenke, f.eks: <code>dittdomene.no/r.html?id=kafe-hansen</code>.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition"
                >
                  Lagre Innstillinger
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 5: GITHUB & GITHUB PAGES SETUP */}
        {activeTab === 'github' && (
          <div className="space-y-8">
            {/* Status-kort */}
            <div className="p-5 rounded-2xl bg-sky-950/40 border border-sky-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold">
                  <Check className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Prosjektet er klargjort for GitHub!</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Git-repo er initialisert, `.github/workflows/deploy.yml` er opprettet, og `base: './'` er konfigurert for GitHub Pages.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const commands = `git remote add origin https://github.com/${ghUser}/${ghRepo}.git\ngit branch -M main\ngit push -u origin main`;
                    navigator.clipboard.writeText(commands);
                    showToast('Kopierte git push-kommandoer!');
                  }}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Kopier Push-kommandoer
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Steg 1: Push-kommandoer generator */}
              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-sky-400" />
                    Kjør disse kommandoene for å pushe til GitHub
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Skriv inn ditt GitHub-brukernavn og repositorium nedenfor for å tilpasse kommandoene:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Ditt GitHub-brukernavn</label>
                    <input
                      type="text"
                      value={ghUser}
                      onChange={(e) => setGhUser(e.target.value.trim())}
                      placeholder="LeonAabak"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Navn på GitHub-repo</label>
                    <input
                      type="text"
                      value={ghRepo}
                      onChange={(e) => setGhRepo(e.target.value.trim())}
                      placeholder="nfc-redirect"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* Kodeboks */}
                <div className="relative">
                  <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-sky-300 overflow-x-auto leading-relaxed">
                    <code>{`# 1. Koble til repositoriet ditt på GitHub:
git remote add origin https://github.com/${ghUser}/${ghRepo}.git

# 2. Sørg for at grenen heter 'main':
git branch -M main

# 3. Push koden opp til GitHub:
git push -u origin main

# HVIS GITHUB KLAGER ("remote contains work..."):
# Dette skjer hvis du huket av for 'Add README' da du lagde repoet på GitHub.
# Løs det enkelt med enten:
git pull origin main --rebase
git push -u origin main

# ...eller overskriv med force:
git push -u origin main --force`}</code>
                  </pre>
                  <button
                    onClick={() => {
                      const snippet = `git remote add origin https://github.com/${ghUser}/${ghRepo}.git\ngit branch -M main\ngit push -u origin main`;
                      navigator.clipboard.writeText(snippet);
                      showToast('Kopierte git push-kommando!');
                    }}
                    className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-sky-600/90 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Kopier
                  </button>
                </div>
              </div>

              {/* Steg 2: Aktivere GitHub Pages */}
              <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Globe className="w-5 h-5 text-sky-400" />
                    Aktivere GitHub Pages
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    To enkle måter å gjøre siden offentlig på nett gratis:
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                      <span>Metode 1: GitHub Actions (Anbefalt)</span>
                    </div>
                    <ol className="list-decimal list-inside text-xs text-slate-400 space-y-1.5">
                      <li>Gå til GitHub-repositoriet ditt.</li>
                      <li>Trykk <strong>Settings → Pages</strong>.</li>
                      <li>Under <strong>Source</strong>, velg <strong>GitHub Actions</strong>.</li>
                      <li>Ferdig! Filen <code className="text-sky-300">.github/workflows/deploy.yml</code> bygger og publiserer automatisk.</li>
                    </ol>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <span>Metode 2: Deploy fra /docs</span>
                    </div>
                    <ol className="list-decimal list-inside text-xs text-slate-400 space-y-1.5">
                      <li>Gå til <strong>Settings → Pages</strong>.</li>
                      <li>Velg <strong>Deploy from a branch</strong>.</li>
                      <li>Velg <strong>main</strong> og mappen <strong>/docs</strong>.</li>
                      <li>Trykk <strong>Save</strong>.</li>
                    </ol>
                  </div>

                  {/* Forventede adresser på GitHub Pages */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-slate-300">
                      Dine adresser når GitHub Pages er aktivert:
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 space-y-1">
                      <div>
                        Omdirigering: <span className="text-sky-400">https://{ghUser}.github.io/{ghRepo}/r.html?id=kafe-hansen</span>
                      </div>
                      <div>
                        Admin: <span className="text-purple-400">https://{ghUser}.github.io/{ghRepo}/admin.html</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
