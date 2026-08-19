(() => {
  document.documentElement.classList.add('js');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointerFine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const addMediaListener = (query, handler) => {
    if (query.addEventListener) query.addEventListener('change', handler);
    else if (query.addListener) query.addListener(handler);
  };

  /* A/B landing attribution */
  const abExperimentId = 'landing-copy-v1';
  const abStorageKey = 'menuStudio.ab.landing.v1';
  const normalizeAbVariant = (value) => {
    const variant = String(value || '').trim().toUpperCase();
    return variant === 'A' || variant === 'B' ? variant : '';
  };
  const normalizeAbMode = (value) => {
    const mode = String(value || '').trim().toLowerCase();
    return ['experiment', 'preview', 'direct'].includes(mode) ? mode : '';
  };
  const abParams = new URLSearchParams(window.location.search);
  const queryAbVariant = normalizeAbVariant(abParams.get('ab_variant'));
  const pageAbVariant = normalizeAbVariant(document.body?.dataset.abVariant);
  const isAbPreview = abParams.get('ab_preview') === '1';
  const queryAbMode = normalizeAbMode(abParams.get('ab_mode'));
  const readStoredAbVariant = () => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(abStorageKey) || 'null');
      if (!stored || stored.experiment !== abExperimentId || Number(stored.expiresAt) <= Date.now()) return '';
      return normalizeAbVariant(stored.variant);
    } catch (error) {
      return '';
    }
  };
  const storedAbVariant = readStoredAbVariant();
  const landingVariant = pageAbVariant || queryAbVariant || (queryAbMode === 'experiment' ? storedAbVariant : '');
  const attributionMode = isAbPreview
    ? 'preview'
    : (queryAbMode || (queryAbVariant ? 'experiment' : 'direct'));
  const landingOriginUrl = pageAbVariant
    ? window.location.href
    : String(abParams.get('ab_landing') || '');
  const persistAbVariant = (variant) => {
    if (!variant || attributionMode !== 'experiment') return;
    try {
      window.localStorage.setItem(abStorageKey, JSON.stringify({
        experiment: abExperimentId,
        variant,
        assignedAt: Date.now(),
        expiresAt: Date.now() + (60 * 60 * 24 * 1 * 1000)
      }));
    } catch (error) {
      // La query ab_variant mantiene comunque l'attribuzione fino al brief.
    }
  };
  const trackAbEvent = (eventName) => {
    if (!landingVariant) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: eventName,
      experiment_id: abExperimentId,
      variant: landingVariant,
      attribution_mode: attributionMode,
      landing_origin: landingOriginUrl,
      page_location: window.location.href
    });
  };

  persistAbVariant(landingVariant);

  if (pageAbVariant) {
    trackAbEvent('ab_landing_view');
    document.querySelectorAll('a[href^="brief.html"]').forEach((link) => {
      const target = new URL(link.getAttribute('href'), window.location.href);
      target.searchParams.set('ab_exp', abExperimentId);
      target.searchParams.set('ab_variant', pageAbVariant);
      target.searchParams.set('ab_mode', attributionMode);
      target.searchParams.set('ab_landing', window.location.href);
      if (isAbPreview) target.searchParams.set('ab_preview', '1');
      link.setAttribute('href', target.href);
      link.addEventListener('click', () => trackAbEvent('ab_brief_click'));
    });
  }

  if (!pageAbVariant && landingVariant) {
    const landingFile = landingVariant === 'B' ? 'landing_copyfabri.html' : 'landing.html';
    document.querySelectorAll('a[href^="landing.html"]').forEach((link) => {
      const target = new URL(link.getAttribute('href').replace(/^landing\.html/, landingFile), window.location.href);
      target.searchParams.set('ab_exp', abExperimentId);
      target.searchParams.set('ab_variant', landingVariant);
      target.searchParams.set('ab_mode', attributionMode);
      if (isAbPreview) target.searchParams.set('ab_preview', '1');
      link.setAttribute('href', target.href);
    });
  }

  /* Interactive dish preview: no camera or AR permission is requested. */
  const arModel = document.querySelector('[data-ar-model]');
  const arModelProgress = arModel?.querySelector('[data-model-progress]');
  const arModelProgressBar = arModelProgress?.querySelector('i');
  const arModelProgressLabel = arModelProgress?.querySelector('span');
  const arModelFallback = document.querySelector('[data-model-fallback]');
  let modelViewerLibraryPromise;

  const showModelFallback = () => {
    if (arModel) arModel.hidden = true;
    if (arModelFallback) arModelFallback.hidden = false;
  };

  const loadModelViewerLibrary = () => {
    if (customElements.get('model-viewer')) return Promise.resolve();
    if (modelViewerLibraryPromise) return modelViewerLibraryPromise;
    modelViewerLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.3.1/model-viewer.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return modelViewerLibraryPromise;
  };

  if (arModel) {
    arModel.addEventListener('progress', (event) => {
      const progress = Math.round((event.detail?.totalProgress || 0) * 100);
      if (arModelProgressBar) arModelProgressBar.style.width = `${progress}%`;
      if (arModelProgressLabel) arModelProgressLabel.textContent = `Caricamento ${progress}%`;
      arModelProgress?.classList.toggle('is-active', progress < 100);
    });
    arModel.addEventListener('load', () => arModelProgress?.classList.remove('is-active'));
    arModel.addEventListener('error', showModelFallback);
    loadModelViewerLibrary()
      .then(() => customElements.whenDefined('model-viewer'))
      .catch(showModelFallback);
  }

  /* FAQ */
  const faqButtons = [...document.querySelectorAll('[data-accordion] .faq-item button')];
  const setFaqState = (button, open) => {
    const item = button.closest('.faq-item');
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    item?.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    panel?.setAttribute('aria-hidden', String(!open));
    if (panel && 'inert' in panel) panel.inert = !open;
  };

  faqButtons.forEach((button) => {
    setFaqState(button, false);
    button.addEventListener('click', () => {
      const shouldOpen = button.getAttribute('aria-expanded') !== 'true';
      faqButtons.forEach((entry) => setFaqState(entry, entry === button && shouldOpen));
    });
  });

  /* Mobile navigation */
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const menuToggleLabel = menuToggle?.querySelector('.sr-only');
  const menu = document.querySelector('[data-menu]');
  const brand = document.querySelector('.site-header .brand');
  const mobileMenu = window.matchMedia('(max-width: 680px)');
  const outsideMenu = [document.querySelector('main'), document.querySelector('.site-footer'), document.querySelector('[data-mobile-cta]')].filter(Boolean);

  const setOutsideMenuInert = (state) => {
    outsideMenu.forEach((element) => {
      if ('inert' in element) element.inert = state;
      else if (state) element.setAttribute('aria-hidden', 'true');
      else element.removeAttribute('aria-hidden');
    });
  };

  const syncMobileMenuAccessibility = () => {
    if (!menu) return;
    const open = menu.classList.contains('is-open');
    if (mobileMenu.matches) menu.setAttribute('aria-hidden', String(!open));
    else menu.removeAttribute('aria-hidden');
    setOutsideMenuInert(mobileMenu.matches && open);
    if (menuToggleLabel) menuToggleLabel.textContent = open ? 'Chiudi navigazione' : 'Apri navigazione';
  };

  const closeMenu = (returnFocus = false) => {
    menuToggle?.setAttribute('aria-expanded', 'false');
    menu?.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    syncMobileMenuAccessibility();
    if (returnFocus) menuToggle?.focus();
  };

  menuToggle?.addEventListener('click', () => {
    const willOpen = menuToggle.getAttribute('aria-expanded') !== 'true';
    menuToggle.setAttribute('aria-expanded', String(willOpen));
    menu?.classList.toggle('is-open', willOpen);
    document.body.classList.toggle('menu-open', willOpen);
    syncMobileMenuAccessibility();
    if (willOpen) menu?.querySelector('a')?.focus();
  });

  menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => closeMenu(false)));
  brand?.addEventListener('click', () => closeMenu(false));
  document.addEventListener('keydown', (event) => {
    if (!menu?.classList.contains('is-open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [menuToggle, ...menu.querySelectorAll('a')].filter(Boolean);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  addMediaListener(mobileMenu, () => closeMenu(false));
  syncMobileMenuAccessibility();

  /* Scroll reveals */
  const revealElements = [...document.querySelectorAll('.reveal, .hero-visual-enter')];
  const revealAll = () => revealElements.forEach((element) => element.classList.add('is-visible'));

  if (!reducedMotion.matches && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });
    revealElements.forEach((element) => revealObserver.observe(element));
  } else {
    revealAll();
  }
  addMediaListener(reducedMotion, (event) => {
    if (event.matches) revealAll();
  });

  /* Fixed header, active navigation and progress */
  const header = document.querySelector('[data-header]');
  const progress = document.querySelector('[data-scroll-progress]');
  const mobileCta = document.querySelector('[data-mobile-cta]');
  let ctaBlocked = false;
  let scrollFrame = 0;

  const setMobileCtaHidden = (hidden) => {
    if (!mobileCta) return;
    mobileCta.classList.toggle('is-hidden', hidden);
    mobileCta.setAttribute('aria-hidden', String(hidden));
    mobileCta.tabIndex = hidden ? -1 : 0;
  };

  const updateScrollUi = () => {
    const y = window.scrollY || document.documentElement.scrollTop;
    const scrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    header?.classList.toggle('is-scrolled', y > 24);
    if (progress) progress.style.transform = `scaleX(${Math.min(y / scrollable, 1)})`;
    setMobileCtaHidden(y < 420 || ctaBlocked);
    scrollFrame = 0;
  };

  const requestScrollUi = () => {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScrollUi);
  };
  window.addEventListener('scroll', requestScrollUi, { passive: true });
  window.addEventListener('resize', requestScrollUi, { passive: true });
  updateScrollUi();

  if ('IntersectionObserver' in window && mobileCta) {
    const blockers = new Set();
    const ctaObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) blockers.add(entry.target);
        else blockers.delete(entry.target);
      });
      ctaBlocked = blockers.size > 0;
      updateScrollUi();
    }, { threshold: 0.04 });
    [document.querySelector('#contatti'), document.querySelector('.site-footer')].filter(Boolean).forEach((element) => ctaObserver.observe(element));
  }

  if ('IntersectionObserver' in window) {
    const navLinks = [...document.querySelectorAll('.site-menu a[href^="#"]')];
    const sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => {
        if (link.getAttribute('href') === `#${visible.target.id}`) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-28% 0px -58% 0px', threshold: [0, 0.2, 0.6] });
    navLinks.forEach((link) => {
      const section = document.querySelector(link.getAttribute('href'));
      if (section) sectionObserver.observe(section);
    });
  }

  /* Pointer depth and card light — desktop only */
  const heroVisual = document.querySelector('[data-tilt]');
  let tiltFrame = 0;
  const resetTilt = () => {
    heroVisual?.style.setProperty('--tilt-x', '0deg');
    heroVisual?.style.setProperty('--tilt-y', '0deg');
  };

  if (heroVisual && pointerFine.matches && !reducedMotion.matches) {
    heroVisual.addEventListener('pointermove', (event) => {
      const rect = heroVisual.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      if (tiltFrame) cancelAnimationFrame(tiltFrame);
      tiltFrame = requestAnimationFrame(() => {
        heroVisual.style.setProperty('--tilt-x', `${(-y * 5).toFixed(2)}deg`);
        heroVisual.style.setProperty('--tilt-y', `${(x * 6).toFixed(2)}deg`);
      });
    });
    heroVisual.addEventListener('pointerleave', resetTilt);
  }
  addMediaListener(reducedMotion, resetTilt);

  if (pointerFine.matches && !reducedMotion.matches) {
    document.querySelectorAll('.feature-card').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
      });
    });
  }

  /* Multi-step qualification brief */
  const form = document.querySelector('#lead-form');
  const status = document.querySelector('[data-form-status]');
  const submitButton = form?.querySelector('.form-submit');
  const initialSubmitLabel = submitButton?.innerHTML || '';
  const successModal = document.querySelector('[data-brief-success]');
  const successDialog = successModal?.querySelector('[role="dialog"]');
  const successCloseButtons = [...(successModal?.querySelectorAll('[data-brief-success-close]') || [])];
  const contactEmail = form?.dataset.contactEmail?.trim() || '';
  const leadEndpoint = form?.dataset.leadEndpoint?.trim() || '';
  const formSteps = [...(form?.querySelectorAll('[data-form-step]') || [])];
  const progressBar = form?.querySelector('[data-form-progress]');
  const progressRoot = form?.querySelector('[data-form-progressbar]');
  const stepLabel = form?.querySelector('[data-form-step-label]');
  let activeStep = 0;

  const showStep = (index, focusFirst = false) => {
    activeStep = Math.max(0, Math.min(index, formSteps.length - 1));
    formSteps.forEach((step, stepIndex) => {
      step.hidden = stepIndex !== activeStep;
    });
    const current = activeStep + 1;
    if (stepLabel) stepLabel.textContent = String(current).padStart(2, '0');
    if (progressBar) progressBar.style.width = `${(current / formSteps.length) * 100}%`;
    progressRoot?.setAttribute('aria-valuenow', String(current));
    if (status) status.textContent = '';
    if (focusFirst) formSteps[activeStep]?.querySelector('input, select, textarea')?.focus();
  };

  const validateCurrentStep = () => {
    const step = formSteps[activeStep];
    if (!step) return true;
    let groupsValid = true;
    step.querySelectorAll('[data-required-group]').forEach((group) => {
      const checked = group.querySelector('input:checked');
      const error = group.parentElement?.querySelector('[data-group-error]');
      if (error) error.hidden = Boolean(checked);
      group.setAttribute('aria-invalid', String(!checked));
      if (!checked) groupsValid = false;
    });
    const invalid = step.querySelector(':invalid');
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return false;
    }
    if (!groupsValid) {
      if (status) status.textContent = 'Completa almeno una delle opzioni richieste.';
      step.querySelector('[data-required-group] input')?.focus();
      return false;
    }
    return true;
  };

  form?.querySelectorAll('[data-form-next]').forEach((button) => {
    button.addEventListener('click', () => {
      if (validateCurrentStep()) showStep(activeStep + 1, true);
    });
  });
  form?.querySelectorAll('[data-form-back]').forEach((button) => {
    button.addEventListener('click', () => showStep(activeStep - 1, true));
  });
  showStep(0);

  const calculateLeadScore = (data) => {
    const budgetPoints = { '€4.999–€10.000': 15, '€10.000–€15.000': 21, '€15.000–€25.000': 26, 'Oltre €25.000': 28, 'Da definire': 9 };
    const timelinePoints = { 'Il prima possibile': 10, 'Entro 1–3 mesi': 9, 'Entro 3–6 mesi': 7, 'Oltre 6 mesi': 4, 'Sto raccogliendo informazioni': 2 };
    const rolePoints = { 'Titolare / decisore': 10, 'Socio / decisione condivisa': 8, 'Marketing / comunicazione': 6, 'Sto raccogliendo informazioni per il team': 2 };
    const stagePoints = { 'Riposizionamento di un locale attivo': 10, 'Nuova apertura': 12, 'Nuova sede o format': 12, 'Fase esplorativa': 4 };
    const services = data.getAll('services');
    const servicePoints = Math.min(services.length * 3, 15) + (services.some((service) => /3D|WebAR/.test(service)) ? 5 : 0);
    const clarityPoints = data.get('message')?.toString().trim().length > 50 ? 8 : 4;
    const assetPoints = { 'Brand già solido, vogliamo elevarlo': 5, 'Identità professionale ma poco distintiva': 7, 'Immagine frammentata e incoerente': 9, 'Serve ripartire dalle fondamenta': 10 };
    const objectivePoints = data.get('objective') ? 7 : 0;
    const presencePoints = data.get('website') ? 4 : 0;
    const score = Math.min(
      (budgetPoints[data.get('budget')] || 0) +
      (timelinePoints[data.get('timeline')] || 0) +
      (rolePoints[data.get('role')] || 0) +
      (stagePoints[data.get('stage')] || 0) +
      servicePoints + clarityPoints +
      (assetPoints[data.get('assets')] || 0) +
      objectivePoints + presencePoints,
      100
    );
    const qualification = score >= 75 ? 'Priority' : score >= 50 ? 'Qualified' : score >= 30 ? 'Nurture' : 'Early stage';
    return { score, qualification };
  };

  const showReadyState = (label = 'Brief ricevuto') => {
    if (!submitButton) return;
    submitButton.classList.add('is-ready');
    submitButton.innerHTML = `${label} <span aria-hidden="true">✓</span>`;
    window.setTimeout(() => {
      submitButton.classList.remove('is-ready');
      submitButton.innerHTML = initialSubmitLabel;
    }, 3600);
  };

  const closeSuccessModal = () => {
    if (!successModal || successModal.hidden) return;
    successModal.classList.remove('is-visible');
    document.body.classList.remove('has-brief-modal');
    window.setTimeout(() => {
      successModal.hidden = true;
      form?.querySelector('input:not(.honeypot), select, textarea')?.focus();
    }, 220);
  };

  const showSuccessModal = () => {
    if (!successModal) return;
    successModal.hidden = false;
    document.body.classList.add('has-brief-modal');
    window.requestAnimationFrame(() => {
      successModal.classList.add('is-visible');
      successDialog?.focus();
    });
  };

  successCloseButtons.forEach((button) => button.addEventListener('click', closeSuccessModal));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && successModal && !successModal.hidden) closeSuccessModal();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (activeStep < formSteps.length - 1) {
      if (validateCurrentStep()) showStep(activeStep + 1, true);
      return;
    }
    if (!validateCurrentStep() || !form.reportValidity()) return;

    const data = new FormData(form);
    if (data.get('company_website')) return;

    const services = data.getAll('services');
    const { score, qualification } = calculateLeadScore(data);
    const payload = {
      restaurant: data.get('restaurant'),
      city: data.get('city'),
      restaurantType: data.get('restaurant_type'),
      stage: data.get('stage'),
      website: data.get('website'),
      objective: data.get('objective'),
      services,
      assets: data.get('assets'),
      budget: data.get('budget'),
      timeline: data.get('timeline'),
      role: data.get('role'),
      name: data.get('name'),
      email: data.get('email'),
      phone: data.get('phone'),
      message: data.get('message'),
      companyWebsite: data.get('company_website'),
      experimentId: landingVariant ? abExperimentId : '',
      landingVariant,
      attributionMode,
      landingUrl: landingOriginUrl,
      privacyConsent: Boolean(data.get('privacy')),
      score,
      qualification,
      submittedAt: new Date().toISOString(),
      source: window.location.href
    };

    const subject = `Candidatura restaurant experience — ${payload.restaurant}`;
    const body = [
      'Nuovo brief per un progetto custom.',
      '',
      `Ristorante: ${payload.restaurant}`,
      `Città / tipologia: ${payload.city} · ${payload.restaurantType}`,
      `Fase: ${payload.stage}`,
      `Obiettivo: ${payload.objective}`,
      `Ambiti: ${services.join(', ')}`,
      `Punto di partenza: ${payload.assets}`,
      `Investimento: ${payload.budget}`,
      `Tempistiche: ${payload.timeline}`,
      `Referente: ${payload.name} · ${payload.role}`,
      `Email: ${payload.email}`,
      `Telefono: ${payload.phone || '—'}`,
      `Sito / Instagram: ${payload.website || '—'}`,
      `Esperimento: ${payload.experimentId || '—'}`,
      `Variante landing: ${payload.landingVariant || '—'}`,
      `Modalità attribuzione: ${payload.attributionMode}`,
      `Visione: ${payload.message || '—'}`
    ].join('\n');

    status?.classList.remove('is-error');
    submitButton?.setAttribute('disabled', '');
    trackAbEvent('ab_brief_submit');

    if (leadEndpoint) {
      try {
        const isGoogleAppsScript = /^https:\/\/(script\.google\.com|script\.googleusercontent\.com)\//i.test(leadEndpoint);
        const requestOptions = isGoogleAppsScript
          ? {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify(payload),
              keepalive: true
            }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify(payload)
            };

        const response = await fetch(leadEndpoint, requestOptions);
        // Le Web App di Apps Script restituiscono una risposta opaca in no-cors:
        // il browser può confermare l'invio, ma non leggerne il contenuto.
        if (!isGoogleAppsScript && !response.ok) {
          throw new Error(`Lead endpoint returned ${response.status}`);
        }
        form.reset();
        showStep(0);
        if (status) status.textContent = '';
        showSuccessModal();
        submitButton?.removeAttribute('disabled');
        return;
      } catch (error) {
        if (status) {
          status.classList.add('is-error');
          status.textContent = 'Non siamo riusciti a inviare il brief. Riprova tra poco o usa il contatto diretto.';
        }
        submitButton?.removeAttribute('disabled');
        return;
      }
    }

    if (contactEmail && !contactEmail.includes('inserisci')) {
      if (status) status.textContent = 'Apro il tuo client email con il brief già compilato…';
      window.location.href = `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      submitButton?.removeAttribute('disabled');
      return;
    }

    const draft = `Oggetto: ${subject}\n\n${body}`;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(draft);
        if (status) status.textContent = 'Brief copiato: puoi incollarlo nel tuo messaggio.';
        showReadyState('Brief pronto');
        submitButton?.removeAttribute('disabled');
        return;
      } catch (error) {
        // Clipboard non disponibile: manteniamo il brief compilato nel form.
      }
    }
    if (status) status.textContent = 'Il brief è pronto. Usa il contatto diretto per inviarlo.';
    submitButton?.removeAttribute('disabled');
  });

  document.querySelectorAll('[data-year]').forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
})();
