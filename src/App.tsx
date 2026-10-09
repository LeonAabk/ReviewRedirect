/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { createClient } from '@supabase/supabase-js';
import {
  QrCode as QrIcon,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Plus,
  Search,
  Smartphone,
  Download,
  Settings,
  X,
  Sliders,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck
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

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [adminPassword, setAdminPassword] = useState('admin');
  const [showSettingsPassword, setShowSettingsPassword] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'nfc'>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
    url: import.meta.env.VITE_SUPABASE_URL || '',
    key: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    customDomain: ''
  });
  const [isConnectedToSupabase, setIsConnectedToSupabase] = useState(
    Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  );

  // Hent aktiv Supabase klient
  const getSupabaseClient = () => {
    if (!config.url || !config.key || config.url.includes('DITT-PROSJEKT')) return null;
    try {
      return createClient(config.url, config.key);
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  // Last live redirects fra Supabase
  const loadLiveRedirects = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    try {
      const { data, error } = await client.from('redirects').select('*');
      if (error) {
        console.error('Supabase query error:', error);
        return;
      }
      if (data) {
        const sorted = data.sort((a, b) => {
          if (a.created_at && b.created_at) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          return (a.id || '').localeCompare(b.id || '');
        });
        setRedirects(sorted);
        if (sorted.length > 0) {
          setSelectedForCard(prev => {
            if (!prev) return sorted[0];
            return sorted.find(s => s.id === prev.id) || sorted[0];
          });
        }
      }
    } catch (e) {
      console.error('Failed to load from Supabase:', e);
    }
  };

  // Last initielle data
  useEffect(() => {
    // Last config
    try {
      const storedConfig = localStorage.getItem('supabase_config');
      const customDomain = localStorage.getItem('custom_domain') || '';
      if (storedConfig) {
        const parsed = JSON.parse(storedConfig);
        setConfig({
          url: parsed.url || import.meta.env.VITE_SUPABASE_URL || '',
          key: parsed.key || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          customDomain: customDomain || ''
        });
        if (parsed.url && parsed.key) {
          setIsConnectedToSupabase(true);
        }
      } else if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
        setConfig({
          url: import.meta.env.VITE_SUPABASE_URL,
          key: import.meta.env.VITE_SUPABASE_ANON_KEY,
          customDomain: customDomain || ''
        });
        setIsConnectedToSupabase(true);
      } else {
        setIsConnectedToSupabase(false);
      }

      // Last admin-passord og sesjonsstatus
      const savedPassword = localStorage.getItem('admin_password') || 'admin';
      setAdminPassword(savedPassword);
      const isSessionUnlocked = sessionStorage.getItem('dashboard_unlocked') === 'true';
      setIsUnlocked(isSessionUnlocked);
    } catch (e) {
      console.error(e);
    }

    loadLiveRedirects();
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

  const handleSaveRedirect = async (e: React.FormEvent) => {
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

    const client = getSupabaseClient();
    if (client) {
      try {
        const { error } = await client
          .from('redirects')
          .upsert({ id: slug, google_url: url }, { onConflict: 'id' });

        if (error) {
          showToast(`Feil fra Supabase: ${error.message}`);
          return;
        }

        showToast(`Lagret "${slug}" direkte i Supabase!`);
        await loadLiveRedirects();
        setSelectedForCard({ id: slug, google_url: url, clicks: 0 });
        setSlugInput('');
        setUrlInput('');
        return;
      } catch (err: any) {
        showToast(`Feil: ${err.message || 'Kunne ikke lagre'}`);
        return;
      }
    }

    // Fallback hvis Supabase ikke er tilkoblet
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
    setSlugInput('');
    setUrlInput('');
  };

  const handleDelete = async (id: string) => {
    if (confirm(`Er du sikker på at du vil slette omdirigeringen for "${id}"?`)) {
      const client = getSupabaseClient();
      if (client) {
        try {
          const { error } = await client.from('redirects').delete().eq('id', id);
          if (error) {
            showToast(`Kunne ikke slette: ${error.message}`);
            return;
          }
          showToast(`Slettet "${id}" fra Supabase!`);
          await loadLiveRedirects();
          return;
        } catch (err: any) {
          console.error(err);
        }
      }
      const updated = redirects.filter(r => r.id !== id);
      setRedirects(updated);
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
    if (adminPassword) {
      localStorage.setItem('admin_password', adminPassword.trim());
    }
    setIsSettingsOpen(false);
    showToast('Innstillinger lagret!');
    loadLiveRedirects();
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const currentPassword = localStorage.getItem('admin_password') || 'admin';
    if (enteredPassword.trim() === currentPassword.trim()) {
      setIsUnlocked(true);
      sessionStorage.setItem('dashboard_unlocked', 'true');
      setPasswordError(false);
      setEnteredPassword('');
      showToast('Dashboard låst opp!');
    } else {
      setPasswordError(true);
      setTimeout(() => setPasswordError(false), 2500);
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem('dashboard_unlocked');
    showToast('Dashboard låst.');
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

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex items-center justify-center p-4 relative overflow-hidden">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-sky-600 text-white px-5 py-3 rounded-lg shadow-xl font-medium text-sm flex items-center gap-2 animate-bounce">
            <Check className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Bakgrunnsdekor */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-2xl p-7 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center mx-auto shadow-lg shadow-sky-500/10">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Privat Administrasjon</h1>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              NFC & QR Redirect Engine er låst. Vennligst oppgi ditt admin-passord for å åpne kontrollpanelet.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">Admin-passord</label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={enteredPassword}
                  onChange={(e) => {
                    setEnteredPassword(e.target.value);
                    setPasswordError(false);
                  }}
                  autoFocus
                  placeholder="Skriv inn passord..."
                  required
                  className={`w-full bg-slate-950 border ${
                    passwordError ? 'border-red-500 ring-2 ring-red-500/20' : 'border-slate-700/80'
                  } rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 pr-11 transition`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                  title={showPassword ? 'Skjul passord' : 'Vis passord'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs text-red-400 mt-2 flex items-center gap-1.5 animate-shake">
                  <span>Feil passord. Prøv igjen.</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-sky-600/25 flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              Lås opp Dashboard
            </button>
          </form>

          <div className="pt-2 border-t border-slate-800 text-center">
            <p className="text-[11px] text-slate-500">
              Kundeomdirigeringer (<code className="text-slate-400 font-mono">r.html?id=...</code>) forblir offentlige uten passord for sømløse NFC-taps.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
                <span>Supabase Live Routing</span>
                <span>·</span>
                <span className="text-emerald-400 font-medium">
                  Tilkoblet
                </span>
              </div>
            </div>
          </div>

          {/* Navigasjon */}
          <div className="flex items-center gap-2 sm:gap-3">
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
            </nav>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition"
              title="Innstillinger"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={handleLock}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-red-950/40 border border-slate-700/60 text-slate-300 hover:text-red-300 hover:border-red-800/50 transition flex items-center gap-1.5 text-xs font-medium"
              title="Lås dashboard / Logg ut"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lås</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hovedinnhold */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
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

        {/* INNSTILLINGER-MODAL */}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Innstillinger & Database</h3>
                    <p className="text-xs text-slate-400">Konfigurer Supabase og domene</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  handleSaveSettings(e);
                  setIsSettingsOpen(false);
                  loadLiveRedirects();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Supabase Prosjekt URL
                  </label>
                  <input
                    type="text"
                    value={config.url}
                    onChange={(e) => setConfig({ ...config, url: e.target.value.trim() })}
                    placeholder="https://xyzcompany.supabase.co"
                    required
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Supabase Anon Public Key
                  </label>
                  <input
                    type="password"
                    value={config.key}
                    onChange={(e) => setConfig({ ...config, key: e.target.value.trim() })}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    required
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Privat Admin-passord
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono">Låser dashboardet</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showSettingsPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Ditt hemmelige passord..."
                      required
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-sky-500 pr-10 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSettingsPassword(!showSettingsPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                      title={showSettingsPassword ? 'Skjul passord' : 'Vis passord'}
                    >
                      {showSettingsPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Passordet som kreves for å åpne dette kontrollpanelet.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Eget Domenenavn (valgfritt)
                  </label>
                  <input
                    type="text"
                    value={config.customDomain}
                    onChange={(e) => setConfig({ ...config, customDomain: e.target.value.trim() })}
                    placeholder="f.eks. mittdomene.no (la stå tom for å bruke aktiv nettside)"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Brukt ved kopiering av lenke, f.eks: <code>dittdomene.no/r.html?id=kafe-hansen</code>.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                  >
                    Avbryt
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition shadow-lg shadow-sky-600/20"
                  >
                    Lagre Innstillinger
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
