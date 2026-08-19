(() => {
  'use strict';

  const EXPERIMENT_ID = 'landing-copy-v1';
  const STORAGE_KEY = 'menuStudio.ab.landing.v1';
  const COOKIE_KEY = 'ms_landing_ab_v1';
  const ASSIGNMENT_DAYS = 1;
  const MAX_AGE_SECONDS = 60 * 60 * 24 * ASSIGNMENT_DAYS;
  const MAX_AGE_MS = MAX_AGE_SECONDS * 1000;

  const VARIANTS = Object.freeze({
    A: 'landing.html',
    B: 'landing_copyfabri.html'
  });

  const normalizeVariant = (value) => {
    const variant = String(value || '').trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(VARIANTS, variant) ? variant : '';
  };

  const readCookie = () => {
    const prefix = `${COOKIE_KEY}=`;
    const match = document.cookie
      .split(';')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(prefix));
    return match ? normalizeVariant(decodeURIComponent(match.slice(prefix.length))) : '';
  };

  const readStoredAssignment = () => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
      if (!stored || stored.experiment !== EXPERIMENT_ID || Number(stored.expiresAt) <= Date.now()) return readCookie();
      return normalizeVariant(stored.variant);
    } catch (error) {
      return readCookie();
    }
  };

  const persistAssignment = (variant) => {
    const assignment = {
      experiment: EXPERIMENT_ID,
      variant,
      assignedAt: Date.now(),
      expiresAt: Date.now() + MAX_AGE_MS
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assignment));
    } catch (error) {
      // Il cookie rimane il fallback per browser con storage disabilitato.
    }

    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(variant)}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  };

  const clearAssignment = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Nessuna azione necessaria.
    }
    document.cookie = `${COOKIE_KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
  };

  const randomVariant = () => {
    if (window.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      window.crypto.getRandomValues(value);
      return value[0] < 0x80000000 ? 'A' : 'B';
    }
    return Math.random() < 0.5 ? 'A' : 'B';
  };

  try {
    const params = new URLSearchParams(window.location.search);
    const forcedVariant = normalizeVariant(params.get('ab_preview') || params.get('variant'));
    const isPreview = Boolean(forcedVariant);

    if (params.get('reset') === '1') clearAssignment();

    let variant = forcedVariant || readStoredAssignment();
    if (!variant) {
      variant = randomVariant();
      persistAssignment(variant);
    }

    params.delete('variant');
    params.delete('ab_preview');
    params.delete('reset');
    params.set('ab_exp', EXPERIMENT_ID);
    params.set('ab_variant', variant);
    params.set('ab_mode', isPreview ? 'preview' : 'experiment');
    if (isPreview) params.set('ab_preview', '1');

    const target = new URL(VARIANTS[variant], window.location.href);
    target.search = params.toString();
    target.hash = window.location.hash;
    window.location.replace(target.href);
  } catch (error) {
    window.location.replace('landing.html');
  }
})();
