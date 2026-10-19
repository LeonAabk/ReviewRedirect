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
  ShieldCheck,
  Pencil,
  ArrowUpDown,
  Globe,
  Sparkles,
  RefreshCw
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
  const [sortBy, setSortBy] = useState<'recent' | 'clicks' | 'name'>('recent');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCopiedId, setIsCopiedId] = useState<string | null>(null);
  const [selectedForCard, setSelectedForCard] = useState<RedirectItem | null>(null);
  const [cardQrDataUrl, setCardQrDataUrl] = useState<string>('');
  const [isSimulatingNfc, setIsSimulatingNfc] = useState(false);

  // Root NFC omdirigering (?id=..., ?slug=..., ?card=..., ?kort=... eller #slug)
  const [redirectParamId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      let id = params.get('id') || params.get('slug') || params.get('card') || params.get('kort');
      if (!id && window.location.hash) {
        const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
        if (rawHash) {
          const hp = new URLSearchParams(rawHash);
          id = hp.get('id') || hp.get('slug') || rawHash;
        }
      }
      return id ? id.trim() : null;
    }
    return null;
  });
  const [redirectStatus, setRedirectStatus] = useState<'loading' | 'success' | 'not_found'>('loading');
  const [redirectTargetUrl, setRedirectTargetUrl] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Redigering av destinasjons-URL og Kort-ID
  const [editingItem, setEditingItem] = useState<RedirectItem | null>(null);
  const [editSlugInput, setEditSlugInput] = useState('');
  const [editUrlInput, setEditUrlInput] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Supabase konfigurasjon
  const [config, setConfig] = useState<SupabaseConfig>({
    url: import.meta.env.VITE_SUPABASE_URL || '',
    key: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    customDomain: ''
  });
  const [isConnectedToSupabase, setIsConnectedToSupabase] = useState(
    Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  );

  const isPlaceholderConfig = (u: string, k: string) => {
    if (!u || !k) return true;
    const lu = u.toLowerCase();
    const lk = k.toLowerCase();
    return lu.includes('ditt-prosjekt') || lu.includes('example') || lk.includes('din-offentlige') || lk.includes('din-anon') || lk === 'admin';
  };

  // Hent aktiv Supabase klient
  const getSupabaseClient = (overrideUrl?: string, overrideKey?: string) => {
    const url = overrideUrl || config.url;
    const key = overrideKey || config.key;
    if (isPlaceholderConfig(url, key)) return null;
    try {
      return createClient(url, key);
    } catch (e) {
      return null;
    }
  };

  const loadMockFallback = () => {
    try {
      const stored = localStorage.getItem('mock_redirects');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRedirects(parsed);
          setSelectedForCard(prev => prev || parsed[0]);
          return;
        }
      }
    } catch (e) {}

    const defaultData: RedirectItem[] = [
      { id: 'kafe-hansen', google_url: 'https://maps.app.goo.gl/kafe-hansen', clicks: 42 },
      { id: 'oslo-barbershop', google_url: 'https://g.page/r/oslo-barbershop/review', clicks: 128 },
      { id: 'bakeri-nord', google_url: 'https://maps.app.goo.gl/bakeri-nord', clicks: 15 }
    ];
    setRedirects(defaultData);
    setSelectedForCard(prev => prev || defaultData[0]);
    try {
      localStorage.setItem('mock_redirects', JSON.stringify(defaultData));
    } catch (e) {}
  };

  const applyRedirectData = (data: RedirectItem[]) => {
    const sorted = data.sort((a, b) => {
      if (a.created_at && b.created_at) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return (a.id || '').localeCompare(b.id || '');
    });
    setRedirects(sorted);
    try {
      localStorage.setItem('mock_redirects', JSON.stringify(sorted));
    } catch (e) {}
    if (sorted.length > 0) {
      setSelectedForCard(prev => {
        if (!prev) return sorted[0];
        return sorted.find(s => s.id === prev.id) || sorted[0];
      });
    }
  };

  // Last live redirects fra felles server (med automatisk synkronisering av eksisterende kort)
  const loadLiveRedirects = async () => {
    try {
      const res = await fetch('/api/redirects');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.items)) {
          let mergedList = [...json.items];

          // Sjekk om det finnes eksisterende kort i localStorage som må synkroniseres til serveren
          try {
            const localRaw = localStorage.getItem('mock_redirects');
            if (localRaw) {
              const localList: RedirectItem[] = JSON.parse(localRaw);
              const missingOnServer = localList.filter(
                localItem => !json.items.some((serverItem: RedirectItem) => serverItem.id.toLowerCase() === localItem.id.toLowerCase())
              );
              if (missingOnServer.length > 0) {
                console.log('Synkroniserer lokale kort til felles server:', missingOnServer);
                await fetch('/api/redirects', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ items: localList })
                });
                const refreshRes = await fetch('/api/redirects');
                if (refreshRes.ok) {
                  const refreshJson = await refreshRes.json();
                  if (refreshJson.items) mergedList = refreshJson.items;
                }
              }
            }
          } catch (syncErr) {
            console.warn('Lokal synk feilet:', syncErr);
          }

          applyRedirectData(mergedList);
          return;
        }
      }
    } catch (apiErr) {
      console.warn('Server API ikke tilgjengelig, prøver Supabase/lokalt:', apiErr);
    }

    // Fallback: Hvis Supabase er tilkoblet
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.from('redirects').select('*');
        if (!error && data) {
          applyRedirectData(data);
          setIsConnectedToSupabase(true);
          return;
        }
      } catch (e) {}
    }

    loadMockFallback();
  };

  const handleSyncLocalToServer = async () => {
    setIsSyncing(true);
    try {
      let itemsToSync = [...redirects];
      const localRaw = localStorage.getItem('mock_redirects');
      if (localRaw) {
        const localList: RedirectItem[] = JSON.parse(localRaw);
        for (const it of localList) {
          if (!itemsToSync.some(r => r.id.toLowerCase() === it.id.toLowerCase())) {
            itemsToSync.push(it);
          }
        }
      }
      const res = await fetch('/api/redirects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToSync })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.items) {
          applyRedirectData(json.items);
        }
        showToast(`Synkroniserte ${itemsToSync.length} kort til felles server!`);
      } else {
        showToast('Kunne ikke synkronisere til server');
      }
    } catch (e) {
      showToast('Nettverksfeil ved synkronisering');
    } finally {
      setIsSyncing(false);
    }
  };

  // Hvis siden åpnes via NFC på rot-URL (?id=... eller ?slug=...)
  useEffect(() => {
    if (!redirectParamId) return;
    const clean = redirectParamId.trim().toLowerCase();
    fetch(`/api/redirect/${encodeURIComponent(clean)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.item && data.item.google_url) {
          let url = data.item.google_url;
          if (!url.startsWith('http')) url = 'https://' + url;
          setRedirectTargetUrl(url);
          setRedirectStatus('success');
          window.location.href = url;
        } else {
          try {
            const raw = localStorage.getItem('mock_redirects');
            if (raw) {
              const list: RedirectItem[] = JSON.parse(raw);
              const found = list.find(r => r.id.toLowerCase() === clean);
              if (found && found.google_url) {
                let url = found.google_url;
                if (!url.startsWith('http')) url = 'https://' + url;
                setRedirectTargetUrl(url);
                setRedirectStatus('success');
                window.location.href = url;
                return;
              }
            }
          } catch (e) {}
          setRedirectStatus('not_found');
        }
      })
      .catch(() => {
        setRedirectStatus('not_found');
      });
  }, [redirectParamId]);

  // Last initielle data
  useEffect(() => {
    try {
      const customDomain = localStorage.getItem('custom_domain') || '';
      const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

      let activeUrl = '';
      let activeKey = '';

      if (envUrl && envKey && !isPlaceholderConfig(envUrl, envKey)) {
        activeUrl = envUrl;
        activeKey = envKey;
        try {
          localStorage.setItem('supabase_config', JSON.stringify({ url: activeUrl, key: activeKey }));
        } catch (e) {}
      } else {
        const storedConfig = localStorage.getItem('supabase_config');
        if (storedConfig) {
          try {
            const parsed = JSON.parse(storedConfig);
            if (parsed.url && parsed.key && !isPlaceholderConfig(parsed.url, parsed.key)) {
              activeUrl = parsed.url;
              activeKey = parsed.key;
            }
          } catch (e) {}
        }
      }

      setConfig({
        url: activeUrl,
        key: activeKey,
        customDomain: customDomain || ''
      });

      if (activeUrl && activeKey && !isPlaceholderConfig(activeUrl, activeKey)) {
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

  // Lytt på vindusfokus for å hente ferske klikktall automatisk etter test i ny fane
  useEffect(() => {
    const handleFocus = () => {
      loadLiveRedirects();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [config.url, config.key]);

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

    // 1. Lagre på felles server API (umiddelbart tilgjengelig for alle telefoner)
    try {
      await fetch('/api/redirects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: slug, google_url: url, clicks: 0 })
      });
    } catch (apiErr) {
      console.warn('Kunne ikke lagre til server:', apiErr);
    }

    // 2. Hvis Supabase er tilkoblet, lagre der også
    const client = getSupabaseClient();
    if (client) {
      try {
        await client
          .from('redirects')
          .upsert({ id: slug, google_url: url }, { onConflict: 'id' });
      } catch (err: any) {}
    }

    // 3. Oppdater lokal state og cache
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
      showToast(`Opprettet og lagret "${slug}" for alle telefoner!`);
      setSelectedForCard(newItem);
    }

    setRedirects(updated);
    try {
      localStorage.setItem('mock_redirects', JSON.stringify(updated));
    } catch (e) {}

    setSlugInput('');
    setUrlInput('');
    await loadLiveRedirects();
  };

  const handleDelete = async (id: string) => {
    if (confirm(`Er du sikker på at du vil slette omdirigeringen for "${id}"?`)) {
      // 1. Slett fra felles server
      try {
        await fetch(`/api/redirects/${encodeURIComponent(id)}`, {
          method: 'DELETE'
        });
      } catch (e) {}

      // 2. Slett fra Supabase hvis tilkoblet
      const client = getSupabaseClient();
      if (client) {
        try {
          await client.from('redirects').delete().eq('id', id);
        } catch (err: any) {}
      }

      // 3. Oppdater lokal state
      const updated = redirects.filter(r => r.id !== id);
      setRedirects(updated);
      try {
        localStorage.setItem('mock_redirects', JSON.stringify(updated));
      } catch (e) {}
      if (selectedForCard?.id === id) {
        setSelectedForCard(updated[0] || null);
      }
      showToast(`Slettet "${id}"`);
      await loadLiveRedirects();
    }
  };

  const openEditModal = (item: RedirectItem) => {
    setEditingItem(item);
    setEditSlugInput(item.id);
    setEditUrlInput(item.google_url);
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setEditSlugInput('');
    setEditUrlInput('');
    setIsSavingEdit(false);
  };

  const handleUpdateRedirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    let newSlug = editSlugInput.trim().toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_]/g, '');

    if (!newSlug) {
      showToast('Kort-ID / slug kan ikke være tom');
      return;
    }

    let newUrl = editUrlInput.trim();
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      newUrl = 'https://' + newUrl;
    }

    if (!newUrl) {
      showToast('Destinasjons-URL kan ikke være tom');
      return;
    }

    const isIdChanged = newSlug !== editingItem.id;
    if (isIdChanged && redirects.some(r => r.id.toLowerCase() === newSlug.toLowerCase())) {
      showToast(`Kort-ID "${newSlug}" finnes allerede. Velg en annen.`);
      return;
    }

    setIsSavingEdit(true);

    // 1. Oppdater på felles server API (tilgjengelig for alle telefoner)
    try {
      await fetch(`/api/redirects/${encodeURIComponent(editingItem.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newId: newSlug, google_url: newUrl })
      });
    } catch (apiErr) {
      console.warn('Feil ved server-oppdatering:', apiErr);
    }

    // 2. Oppdater i Supabase dersom tilkoblet
    const client = getSupabaseClient();
    if (client) {
      try {
        if (isIdChanged) {
          const { error: updateErr } = await client
            .from('redirects')
            .update({ id: newSlug, google_url: newUrl })
            .eq('id', editingItem.id);

          if (updateErr) {
            await client
              .from('redirects')
              .insert({
                id: newSlug,
                google_url: newUrl,
                clicks: editingItem.clicks || 0,
                created_at: editingItem.created_at || new Date().toISOString()
              });
            await client.from('redirects').delete().eq('id', editingItem.id);
          }
        } else {
          await client
            .from('redirects')
            .update({ google_url: newUrl })
            .eq('id', editingItem.id);
        }
      } catch (err: any) {}
    }

    // 3. Oppdater lokal state
    const updated = redirects.map(r => {
      if (r.id === editingItem.id) {
        return { ...r, id: newSlug, google_url: newUrl };
      }
      return r;
    });

    setRedirects(updated);
    try {
      localStorage.setItem('mock_redirects', JSON.stringify(updated));
    } catch (e) {}

    if (selectedForCard?.id === editingItem.id) {
      setSelectedForCard({ ...selectedForCard, id: newSlug, google_url: newUrl });
    }

    showToast(isIdChanged
      ? `Oppdaterte Kort-ID til "${newSlug}" og destinasjons-URL for alle!`
      : `Oppdaterte destinasjon for "${editingItem.id}" for alle!`);

    setIsSavingEdit(false);
    closeEditModal();
    await loadLiveRedirects();
  };

  const handleCopyLink = (id: string) => {
    const url = buildFullUrl(id);
    navigator.clipboard.writeText(url).then(() => {
      setIsCopiedId(id);
      showToast(`Kopierte: ${url}`);
      setTimeout(() => setIsCopiedId(null), 2000);
    });
  };

  const handleTestRedirect = (e: React.MouseEvent, item: RedirectItem) => {
    // 1. Synkroniser config og oppdaterte redirects til localStorage slik at r.html umiddelbart har nyeste data
    try {
      if (config.url && config.key) {
        localStorage.setItem('supabase_config', JSON.stringify({ url: config.url, key: config.key }));
      }
      localStorage.setItem('mock_redirects', JSON.stringify(redirects));
    } catch (err) {}

    // 2. Optimistisk oppdatering av klikkteller i tabellen
    const updated = redirects.map(r => r.id === item.id ? { ...r, clicks: (r.clicks || 0) + 1 } : r);
    setRedirects(updated);
    if (selectedForCard?.id === item.id) {
      setSelectedForCard(prev => prev ? { ...prev, clicks: prev.clicks + 1 } : null);
    }
    try {
      localStorage.setItem('mock_redirects', JSON.stringify(updated));
    } catch (err) {}

    showToast(`Tester omdirigering for "${item.id}" (klikk registrert)`);

    // 3. Last ferske data fra Supabase etter at r.html har fullført omdirigeringen
    setTimeout(() => {
      loadLiveRedirects();
    }, 1500);
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
    const currentPassword = (localStorage.getItem('admin_password') || 'admin').trim();
    const cleanEntered = enteredPassword.trim();
    const isMatch = cleanEntered === currentPassword ||
      (currentPassword.toLowerCase() === 'admin' && cleanEntered.toLowerCase() === 'admin');

    if (isMatch) {
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

  const simulateNfcTap = async () => {
    if (!selectedForCard) return;
    setIsSimulatingNfc(true);

    const client = getSupabaseClient();
    if (client) {
      try {
        await client
          .from('redirects')
          .update({ clicks: (selectedForCard.clicks || 0) + 1 })
          .eq('id', selectedForCard.id);
      } catch (e) {
        console.error('Kunne ikke oppdatere klikk i Supabase:', e);
      }
    }

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
      loadLiveRedirects();
    }, 700);
  };

  const filteredRedirects = redirects
    .filter(item => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return item.id.toLowerCase().includes(term) || item.google_url.toLowerCase().includes(term);
    })
    .sort((a, b) => {
      if (sortBy === 'clicks') {
        return (b.clicks || 0) - (a.clicks || 0);
      }
      if (sortBy === 'name') {
        return a.id.localeCompare(b.id);
      }
      if (a.created_at && b.created_at) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return a.id.localeCompare(b.id);
    });

  const totalClicks = redirects.reduce((sum, item) => sum + (item.clicks || 0), 0);
  const mostPopular = [...redirects].sort((a, b) => b.clicks - a.clicks)[0];

  // 1. NFC / QR Omdirigering for besøkende (?id=... eller ?slug=...)
  if (redirectParamId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {redirectStatus === 'loading' && (
          <div className="relative bg-slate-900/95 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4 shadow-2xl backdrop-blur-xl">
            <div className="w-12 h-12 border-3 border-sky-500/30 border-t-sky-500 rounded-full animate-spin mx-auto" />
            <h2 className="text-lg font-bold text-white tracking-tight">Kobler til omdirigering...</h2>
            <p className="text-xs text-slate-400">
              Videresender deg til Google Maps for <span className="text-sky-300 font-mono font-medium">{redirectParamId}</span>
            </p>
          </div>
        )}

        {redirectStatus === 'success' && (
          <div className="relative bg-slate-900/95 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold shadow-lg shadow-emerald-500/10">
              <Check className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Omdirigert til Google Maps</h2>
              <p className="text-xs text-slate-400 mt-1">
                Kortet for <span className="text-sky-300 font-mono font-medium">{redirectParamId}</span> er aktivert.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  try { window.close(); } catch (e) {}
                  try { self.close(); } catch (e) {}
                  try { window.open('', '_self', ''); window.close(); } catch (e) {}
                  if (window.history.length > 1) {
                    try { window.history.back(); } catch (e) {}
                  }
                }}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-600/25 cursor-pointer min-h-[46px]"
              >
                Lukk denne fanen
              </button>
              <a
                href={redirectTargetUrl}
                className="block w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition text-center min-h-[40px] flex items-center justify-center"
              >
                Åpne i Google Maps igjen
              </a>
            </div>
            <p className="text-[11px] text-slate-500">
              Du kan nå trygt lukke denne fanen på telefonen din.
            </p>
          </div>
        )}

        {redirectStatus === 'not_found' && (
          <div className="relative bg-slate-900/95 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4 shadow-2xl backdrop-blur-xl">
            <div className="w-12 h-12 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Kort ikke funnet</h2>
            <p className="text-xs text-slate-400">
              Fant ingen registrert omdirigering for ID: <code className="text-amber-300 font-mono">{redirectParamId}</code>.
            </p>
            <p className="text-[11px] text-slate-500">
              Sjekk at kortet er registrert og lagret i kontrollpanelet.
            </p>
          </div>
        )}
      </div>
    );
  }

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

        <div className="relative w-full max-w-sm sm:max-w-md bg-slate-900/95 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-2xl backdrop-blur-xl space-y-5 sm:space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center mx-auto shadow-lg shadow-sky-500/10">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">Privat Administrasjon</h1>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              NFC & QR Redirect Engine er låst. Oppgi ditt admin-passord for å åpne kontrollpanelet.
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
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Skriv inn passord..."
                  required
                  className={`w-full bg-slate-950 border ${
                    passwordError ? 'border-red-500 ring-2 ring-red-500/20' : 'border-slate-700/80'
                  } rounded-xl px-4 py-3 text-base sm:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 pr-11 transition min-h-[46px]`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition p-1"
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
              className="w-full py-3.5 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 active:from-sky-700 active:to-sky-600 text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-sky-600/25 flex items-center justify-center gap-2 min-h-[46px] cursor-pointer"
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
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between gap-2 sm:gap-6">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-base sm:text-lg border border-sky-500/30">
              ⚡
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-slate-100 text-sm sm:text-lg leading-tight tracking-tight truncate">
                <span className="sm:hidden">NFC & QR</span>
                <span className="hidden sm:inline">NFC & QR Redirect Engine</span>
              </h1>
              <div className="text-[10px] sm:text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                <span className="hidden xs:inline">Felles Server</span>
                <span className="hidden xs:inline">·</span>
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                  Aktiv for alle enheter
                </span>
              </div>
            </div>
          </div>

          {/* Navigasjon */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={handleSyncLocalToServer}
              disabled={isSyncing}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 border border-slate-700/80 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold min-h-[36px] cursor-pointer"
              title="Synkroniser og sikkerhetskopier alle kort til felles server"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Synk til server</span>
            </button>

            <nav className="flex items-center gap-1 p-0.5 sm:p-1 bg-slate-950/70 rounded-xl border border-slate-800/80">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-h-[36px] flex items-center ${
                  activeTab === 'dashboard'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('nfc')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-h-[36px] flex items-center ${
                  activeTab === 'nfc'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span className="sm:hidden">Kort</span>
                <span className="hidden sm:inline">NFC & QR Generator</span>
              </button>
            </nav>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 active:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
              title="Innstillinger"
              aria-label="Innstillinger"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={handleLock}
              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-800/70 hover:bg-red-950/40 active:bg-red-950/70 border border-slate-700/60 text-slate-300 hover:text-red-300 hover:border-red-800/50 transition flex items-center gap-1.5 text-xs font-medium min-h-[36px] cursor-pointer"
              title="Lås dashboard / Logg ut"
              aria-label="Lås dashboard"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Lås</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hovedinnhold */}
      <main className="max-w-7xl mx-auto px-3.5 sm:px-6 pt-5 sm:pt-8">

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 sm:space-y-8">
            {/* Statistikk-oversikt */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5">
                <div className="text-[11px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold">Aktive Omdirigeringer</div>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1 tabular-nums">
                  {redirects.length}
                </div>
                <div className="text-xs text-slate-500 mt-1 sm:mt-2">Knyttet til NFC & QR-koder</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5">
                <div className="text-[11px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold">Totale Omdirigeringer / Klikk</div>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-sky-400 mt-1 tabular-nums">
                  {totalClicks}
                </div>
                <div className="text-xs text-slate-500 mt-1 sm:mt-2">Registrert automatisk i Supabase</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5">
                <div className="text-[11px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold">Mest Populære Bedrift</div>
                <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400 mt-1 truncate">
                  {mostPopular ? `${mostPopular.id} (${mostPopular.clicks})` : '-'}
                </div>
                <div className="text-xs text-slate-500 mt-1 sm:mt-2">Flest Google Review-taps</div>
              </div>
            </div>

            {/* Skjema for å legge til nye bedrifter */}
            <section className="bg-slate-900/90 border border-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
              <div className="mb-4 sm:mb-5">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <Plus className="w-5 h-5 text-sky-400" />
                  Legg til ny bedrift / omdirigering
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Knytt en unik NFC/QR-slug (f.eks. <code className="text-sky-300">kafe-hansen</code>) til kundens offisielle Google Review-adresse.
                </p>
              </div>

              <form onSubmit={handleSaveRedirect} className="grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-4 items-end">
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
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-base sm:text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition min-h-[44px]"
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
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition min-h-[44px]"
                  />
                </div>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="w-full h-[44px] min-h-[44px] bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Lagre
                  </button>
                </div>

                <div className="md:col-span-12 flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] text-slate-400 font-medium">Hurtigeksempler for URL:</span>
                  <button
                    type="button"
                    onClick={() => setUrlInput('https://search.google.com/local/writereview?placeid=DIN_PLACE_ID_HER')}
                    className="px-2.5 py-1 rounded-md bg-amber-950/40 hover:bg-amber-900/40 text-[11px] text-amber-300 border border-amber-700/50 transition cursor-pointer font-medium"
                  >
                    Google WriteReview (Place ID)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrlInput('https://maps.app.goo.gl/')}
                    className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700 transition cursor-pointer"
                  >
                    Google Maps Review
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrlInput('https://instagram.com/')}
                    className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700 transition cursor-pointer"
                  >
                    Instagram
                  </button>
                </div>

                {slugInput.trim() && redirects.some(r => r.id.toLowerCase() === slugInput.trim().toLowerCase()) && (
                  <div className="md:col-span-12 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/40 p-2.5 rounded-lg flex items-center gap-2">
                    <Pencil className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span>
                      Merk: Kunde-ID «<strong className="text-white font-mono">{slugInput.trim()}</strong>» finnes fra før. Ved å trykke <strong>Lagre</strong> oppdateres destinasjons-URL-en for dette kortet.
                    </span>
                  </div>
                )}
              </form>
            </section>

            {/* Tabell & Kort-oversikt over omdirigeringer */}
            <section className="bg-slate-900/90 border border-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      Registrerte NFC-kort & omdirigeringer
                    </h2>
                    <span className="text-[11px] font-mono bg-slate-800 text-sky-300 px-2.5 py-0.5 rounded-full border border-slate-700 font-semibold">
                      {filteredRedirects.length} {filteredRedirects.length === 1 ? 'kort' : 'kort'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                    Full oversikt over hvor hvert enkelt kort omdirigerer. Trykk «Rediger» for å endre måladresse når som helst.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* Sortering */}
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e: any) => setSortBy(e.target.value)}
                      className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-sky-500 min-h-[40px] sm:min-h-0 cursor-pointer font-medium"
                      title="Sorter omdirigeringer"
                    >
                      <option value="recent">Nyeste først</option>
                      <option value="clicks">Flest klikk</option>
                      <option value="name">Kort-ID (A-Å)</option>
                    </select>
                  </div>

                  {/* Søk */}
                  <div className="relative flex-1 sm:w-56">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Søk i kort og URL..."
                      className="bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-8 py-2 text-base sm:text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 w-full transition min-h-[40px] sm:min-h-0"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5 cursor-pointer"
                        title="Tøm søk"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* MOBILVISNING (Kort): Vises kun på mobil (< md) */}
              <div className="space-y-3 block md:hidden">
                {filteredRedirects.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/60 p-4">
                    Ingen omdirigeringer funnet. Legg til en over!
                  </div>
                ) : (
                  filteredRedirects.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-3"
                    >
                      {/* Topp: ID og Klikk-teller */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-sky-400 text-sm tracking-tight truncate">
                          {item.id}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700/80 font-mono text-xs font-bold text-emerald-400 tabular-nums shrink-0">
                          <span className="text-[10px] text-slate-400 font-sans font-normal">klikk:</span>
                          {item.clicks || 0}
                        </span>
                      </div>

                      {/* Destinasjonslenke med Endre-knapp */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Sender brukeren til:</span>
                          <button
                            onClick={() => openEditModal(item)}
                            className="text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Endre URL</span>
                          </button>
                        </div>
                        <a
                          href={item.google_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-white hover:underline flex items-center gap-1.5 text-xs text-slate-300 break-all bg-slate-900/80 p-2.5 rounded-lg border border-slate-800"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                          <span className="truncate">{item.google_url}</span>
                        </a>
                      </div>

                      {/* Handlingsknapper på mobil */}
                      <div className="space-y-2 pt-1 border-t border-slate-800/60">
                        <button
                          onClick={() => openEditModal(item)}
                          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500/30 text-xs font-bold text-amber-300 border border-amber-500/30 transition min-h-[42px] cursor-pointer"
                        >
                          <Pencil className="w-4 h-4 text-amber-400" />
                          <span>Rediger destinasjons-URL</span>
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleCopyLink(item.id)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 active:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition min-h-[40px] cursor-pointer"
                          >
                            {isCopiedId === item.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Kopiert!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                <span>Kopier lenke</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => {
                              setSelectedForCard(item);
                              setActiveTab('nfc');
                            }}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 active:bg-slate-700 text-xs font-medium text-purple-300 border border-slate-700 transition min-h-[40px] cursor-pointer"
                          >
                            <QrIcon className="w-3.5 h-3.5" />
                            <span>QR & Kort</span>
                          </button>

                          <a
                            href={buildFullUrl(item.id)}
                            onClick={(e) => handleTestRedirect(e, item)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-950/60 active:bg-sky-900 text-xs font-semibold text-sky-300 border border-sky-800/60 transition min-h-[40px] cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Test</span>
                          </a>

                          <button
                            onClick={() => handleDelete(item.id)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 active:bg-red-950/60 text-xs font-medium text-red-400 border border-slate-700 active:border-red-800 transition min-h-[40px] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Slett</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* DESKTOP/NETTBRETT TABELL: Vises på md og oppover */}
              <div className="hidden md:block overflow-x-auto border border-slate-800/80 rounded-xl">
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
                            <div className="flex items-center gap-2">
                              <a
                                href={item.google_url}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:text-white hover:underline flex items-center gap-1.5 text-xs text-slate-300 truncate"
                              >
                                <span className="truncate">{item.google_url}</span>
                                <ExternalLink className="w-3 h-3 shrink-0 text-slate-500" />
                              </a>
                              <button
                                onClick={() => openEditModal(item)}
                                className="text-slate-500 hover:text-amber-400 p-1 rounded transition cursor-pointer shrink-0"
                                title="Rediger URL"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-white tabular-nums">
                            {item.clicks || 0}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => openEditModal(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 text-xs font-semibold text-amber-300 border border-amber-500/30 transition cursor-pointer"
                              title="Rediger destinasjons-URL for dette kortet"
                            >
                              <Pencil className="w-3.5 h-3.5 text-amber-400" />
                              <span>Rediger</span>
                            </button>

                            <button
                              onClick={() => handleCopyLink(item.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition cursor-pointer"
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
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-purple-300 border border-slate-700 transition cursor-pointer"
                              title="Generer NFC & QR-kort"
                            >
                              <QrIcon className="w-3.5 h-3.5" />
                              <span>QR-kort</span>
                            </button>

                            <a
                              href={buildFullUrl(item.id)}
                              onClick={(e) => handleTestRedirect(e, item)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-sky-950/60 text-xs font-medium text-sky-300 border border-slate-700 hover:border-sky-500/50 transition cursor-pointer"
                              title={`Test omdirigering for ${item.id} -> ${item.google_url}`}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Test</span>
                            </a>

                            <button
                              onClick={() => handleDelete(item.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-red-950/40 text-xs font-medium text-red-400 border border-slate-700 hover:border-red-800 transition cursor-pointer"
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
          <div className="space-y-6 sm:space-y-8">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-sky-400" />
                    NFC-Kort & Borddisplay Generator
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Forhåndsvis det fysiske NFC-kortet eller borddisplayet for en valgt bedrift, test virtuell NFC-berøring, eller last ned QR-koden for trykk.
                  </p>
                </div>

                {/* Velg bedrift */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                  <label className="text-xs font-semibold text-slate-400">Velg bedrift:</label>
                  <select
                    value={selectedForCard?.id || ''}
                    onChange={(e) => {
                      const found = redirects.find(r => r.id === e.target.value);
                      if (found) setSelectedForCard(found);
                    }}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-base sm:text-sm text-white font-mono focus:outline-none focus:border-sky-500 w-full sm:w-auto min-h-[40px]"
                  >
                    {redirects.map(r => (
                      <option key={r.id} value={r.id}>{r.id} ({r.clicks} klikk)</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedForCard ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
                  {/* Fysisk Kort-Mockup */}
                  <div className="lg:col-span-7 flex justify-center">
                    <div className="relative w-full max-w-md aspect-[1.586/1] rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 border border-slate-700/80 p-4 sm:p-6 shadow-2xl flex flex-col justify-between overflow-hidden">
                      {/* Bakgrunnsdekor */}
                      <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
                      <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl pointer-events-none"></div>

                      {/* Topp på kort */}
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-white text-xs sm:text-sm border border-white/20 shrink-0">
                            ★
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider truncate">
                              Gi oss en anmeldelse
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-white capitalize truncate">
                              {selectedForCard.id.replace(/-/g, ' ')}
                            </div>
                          </div>
                        </div>

                        {/* NFC Brikke-ikon */}
                        <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 text-[10px] sm:text-xs font-medium shrink-0">
                          <Smartphone className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                          <span>NFC Tap</span>
                        </div>
                      </div>

                      {/* Midtparti med QR-kode */}
                      <div className="relative z-10 flex items-center justify-between my-1 sm:my-2 gap-2">
                        <div className="space-y-1 sm:space-y-2 max-w-[170px] sm:max-w-[200px]">
                          <div className="text-[11px] sm:text-xs text-slate-300 leading-snug sm:leading-relaxed">
                            Hold telefonen inntil kortet eller skann QR-koden for å gi anmeldelse.
                          </div>
                          <div className="text-[10px] sm:text-[11px] font-mono text-sky-400 break-all bg-black/40 px-2 py-0.5 sm:py-1 rounded border border-white/5 truncate">
                            ?id={selectedForCard.id}
                          </div>
                        </div>

                        {cardQrDataUrl && (
                          <div className="bg-white p-1.5 sm:p-2 rounded-xl shadow-lg border border-slate-200 shrink-0">
                            <img src={cardQrDataUrl} alt="QR Kode" className="w-18 h-18 sm:w-28 sm:h-28" />
                          </div>
                        )}
                      </div>

                      {/* Bunn på kort */}
                      <div className="relative z-10 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 pt-1.5 sm:pt-2 border-t border-white/10">
                        <span>Google Reviews Direct</span>
                        <span className="font-mono tabular-nums">{selectedForCard.clicks} anmeldelses-taps</span>
                      </div>
                    </div>
                  </div>

                  {/* Handlinger for kort */}
                  <div className="lg:col-span-5 space-y-4 sm:space-y-5">
                    <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 sm:space-y-3">
                      <div className="text-[11px] sm:text-xs uppercase font-semibold tracking-wider text-slate-400">
                        Aktiv Omdirigerings-URL
                      </div>
                      <div className="font-mono text-xs text-sky-400 bg-slate-900 p-2.5 rounded-lg border border-slate-800 break-all">
                        {buildFullUrl(selectedForCard.id)}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-slate-400 break-all truncate">
                          Mål: <span className="text-slate-200">{selectedForCard.google_url}</span>
                        </div>
                        <button
                          onClick={() => openEditModal(selectedForCard)}
                          className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold border border-amber-500/30 flex items-center gap-1 shrink-0 cursor-pointer"
                          title="Endre hvor dette kortet omdirigerer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Endre mål</span>
                        </button>
                      </div>
                      <button
                        onClick={() => openEditModal(selectedForCard)}
                        className="w-full py-2.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500/30 border border-amber-500/30 rounded-lg text-amber-300 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer min-h-[38px]"
                      >
                        <Pencil className="w-3.5 h-3.5 text-amber-400" />
                        <span>Rediger destinasjons-URL for dette kortet</span>
                      </button>
                    </div>

                    {/* Simuleringsknapp */}
                    <div className="space-y-3">
                      <button
                        onClick={simulateNfcTap}
                        disabled={isSimulatingNfc}
                        className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 active:from-sky-700 active:to-sky-600 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 disabled:opacity-50 min-h-[46px] cursor-pointer"
                      >
                        <Smartphone className="w-5 h-5 animate-pulse" />
                        {isSimulatingNfc ? 'Registrerer NFC Tap...' : 'Simuler Telefon Tap på NFC-Kort'}
                      </button>

                      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                        {cardQrDataUrl && (
                          <a
                            href={cardQrDataUrl}
                            download={`qr-${selectedForCard.id}.png`}
                            className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 min-h-[42px]"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Last ned QR</span>
                          </a>
                        )}
                        <button
                          onClick={() => handleCopyLink(selectedForCard.id)}
                          className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 min-h-[42px] cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Kopier URL</span>
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
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[88vh] overflow-y-auto p-5 sm:p-6 shadow-2xl relative space-y-4 sm:space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20 shrink-0">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Innstillinger & Database</h3>
                    <p className="text-xs text-slate-400">Konfigurer Supabase og domene</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
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
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-base sm:text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition min-h-[42px]"
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
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-base sm:text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition min-h-[42px]"
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
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-base sm:text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-sky-500 pr-10 transition min-h-[42px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSettingsPassword(!showSettingsPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition p-1"
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
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-base sm:text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition min-h-[42px]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Brukt ved kopiering av lenke, f.eks: <code>dittdomene.no/r.html?id=kafe-hansen</code>.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition min-h-[40px] cursor-pointer"
                  >
                    Avbryt
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition shadow-lg shadow-sky-600/20 min-h-[40px] cursor-pointer"
                  >
                    Lagre Innstillinger
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* EDIT REDIRECT MODAL */}
        {editingItem && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg p-5 sm:p-7 shadow-2xl space-y-5 sm:space-y-6 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      Rediger Kort-ID & Destinasjon
                    </h3>
                    <p className="text-xs text-slate-400">
                      Endre kortnavn/ID og hvor NFC-kortet omdirigerer
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeEditModal}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateRedirect} className="space-y-4">
                {/* Rediger Kort-ID / Navn */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-200">
                      Kort-ID / Navn (slug)
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono truncate max-w-[200px]">
                      {buildFullUrl(editSlugInput.trim() || editingItem.id)}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={editSlugInput}
                    onChange={(e) => setEditSlugInput(e.target.value)}
                    placeholder="f.eks. kafe-hansen"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-base sm:text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition min-h-[46px]"
                  />
                  <div className="mt-2 text-[11px] text-slate-400 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                    💡 <strong className="text-slate-300">Tips:</strong> Hvis du endrer selve <strong>Kort-ID</strong>-en, oppdateres også kortets faste nettadresse. Hvis du allerede har programmert fysiske NFC-kort med <code className="text-sky-300 font-mono">{editingItem.id}</code>, kan du beholde samme Kort-ID og kun endre <strong>Destinasjons-URL</strong> under slik at de umiddelbart peker til det nye stedet.
                  </div>
                </div>

                {/* Rediger Destinasjons-URL */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-200">
                      Ny Destinasjons-URL (hvor kortet skal sende brukeren)
                    </label>
                    {editUrlInput && (
                      <a
                        href={editUrlInput.startsWith('http') ? editUrlInput : `https://${editUrlInput}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Test denne lenken
                      </a>
                    )}
                  </div>
                  <input
                    type="url"
                    value={editUrlInput}
                    onChange={(e) => setEditUrlInput(e.target.value)}
                    placeholder="https://search.google.com/local/writereview?placeid=..."
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-base sm:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition min-h-[46px]"
                  />
                </div>

                {/* Hurtigvalg / Hurtigforslag */}
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">Hurtigeksempler:</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditUrlInput('https://search.google.com/local/writereview?placeid=DIN_PLACE_ID_HER')}
                      className="px-2.5 py-1 rounded-md bg-amber-950/40 hover:bg-amber-900/40 text-[11px] text-amber-300 border border-amber-700/50 transition cursor-pointer font-medium"
                    >
                      Google WriteReview (Place ID)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditUrlInput('https://maps.app.goo.gl/')}
                      className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700 transition cursor-pointer"
                    >
                      Google Maps Review
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditUrlInput('https://instagram.com/')}
                      className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700 transition cursor-pointer"
                    >
                      Instagram
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditUrlInput('https://www.google.com/maps/search/?api=1&query=')}
                      className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700 transition cursor-pointer"
                    >
                      Google Søk
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-semibold transition cursor-pointer min-h-[42px]"
                  >
                    Avbryt
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs sm:text-sm font-bold transition shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50 min-h-[42px]"
                  >
                    <Check className="w-4 h-4" />
                    {isSavingEdit ? 'Lagrer i Supabase...' : 'Lagre endringer'}
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
