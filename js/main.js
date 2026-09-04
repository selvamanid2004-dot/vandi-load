/**
 * Vandi Load - Main Application Logic
 * Initializes dynamic catalog, categories, gallery, live content, settings, and interactive load helper.
 */

let LIVE_CATEGORIES = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Fetch live categories
  await loadLiveCategories();

  // 2. Fetch live settings and content
  await applyLiveSettingsAndContent();

  // 3. Fetch and render live vehicles from database
  if (typeof loadLiveVehicles === 'function') {
    await loadLiveVehicles();
  }
  renderVehicleCatalog('all');

  // 4. Fetch and render live gallery
  if (typeof loadLiveGallery === 'function') {
    await loadLiveGallery();
  }
  if (typeof renderGallery === 'function') {
    renderGallery('all');
  }

  // 5. Setup Sticky Navbar & Scroll Spy
  const header = document.getElementById('siteHeader');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  });

  // 6. Mobile Menu Toggle
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const navMenu = document.getElementById('navMenu');
  
  mobileToggle?.addEventListener('click', () => {
    navMenu?.classList.toggle('open');
  });

  // Close mobile menu on link click
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navMenu?.classList.remove('open');
    });
  });

  // 7. Hero Quick Load Estimator Assistant Form
  const quickEstimatorForm = document.getElementById('heroQuickEstimator');
  if (quickEstimatorForm) {
    quickEstimatorForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const loadType = document.getElementById('quickLoadType')?.value || 'boxes';
      const quantity = document.getElementById('quickQuantity')?.value || '50';
      
      const recommendation = estimateVehicleForLoad(loadType, quantity);
      
      // Open modal with recommendation
      openGetVehicleModal(recommendation.vehicleId);

      // Pre-fill notes
      const notesField = document.getElementById('reqLoadNotes');
      if (notesField) {
        notesField.value = `Load Details: ${quantity} ${loadType}. Recommended: ${recommendation.vehicleName} (${recommendation.reason})`;
      }
    });
  }

  // Quick chip buttons in helper
  document.querySelectorAll('.quick-chips .chip-btn').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.quick-chips .chip-btn').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      
      const val = chip.getAttribute('data-val');
      const type = chip.getAttribute('data-type');
      
      const qtyInput = document.getElementById('quickQuantity');
      const typeSelect = document.getElementById('quickLoadType');
      
      if (qtyInput && val) qtyInput.value = val;
      if (typeSelect && type) typeSelect.value = type;
    });
  });
});

/**
 * Load dynamic categories and render catalog filter pills
 */
async function loadLiveCategories() {
  if (typeof ClientAPI === 'undefined') return;

  const cats = await ClientAPI.getCategories();
  if (cats && cats.length > 0) {
    LIVE_CATEGORIES = cats;
    renderCategoryFilterPills(cats);
  } else {
    setupStaticFilterListeners();
  }
}

/**
 * Render dynamic category filter buttons
 */
function renderCategoryFilterPills(categories) {
  const filterContainer = document.querySelector('.catalog-filters');
  if (!filterContainer) return;

  filterContainer.innerHTML = `
    <button class="filter-btn active" data-filter="all">All Vehicles</button>
    ${categories.map(c => `<button class="filter-btn" data-filter="${c.id}">${c.name}</button>`).join('')}
  `;

  setupStaticFilterListeners();
}

function setupStaticFilterListeners() {
  const filterButtons = document.querySelectorAll('.catalog-filters .filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const category = btn.getAttribute('data-filter') || 'all';
      renderVehicleCatalog(category);
    });
  });
}

/**
 * Apply live website content and settings from the database
 */
async function applyLiveSettingsAndContent() {
  if (typeof ClientAPI === 'undefined') return;

  // Apply Settings
  const settings = await ClientAPI.getSettings();
  if (settings) {
    // Phone
    if (settings.phone_number) {
      document.querySelectorAll('a[href^="tel:"]').forEach(el => {
        el.href = `tel:${settings.phone_number.replace(/\s+/g, '')}`;
        el.textContent = settings.phone_number;
      });
    }
    // WhatsApp
    if (settings.whatsapp_number) {
      document.querySelectorAll('a[href*="wa.me"]').forEach(el => {
        const cleanNumber = settings.whatsapp_number.replace(/[^0-9]/g, '');
        el.href = `https://wa.me/${cleanNumber}`;
        el.textContent = settings.whatsapp_number;
      });
    }
    // Email
    if (settings.email) {
      document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
        el.href = `mailto:${settings.email}`;
        el.textContent = settings.email;
      });
    }
  }

  // Apply Content
  const content = await ClientAPI.getContent();
  if (content) {
    // 1. Hero
    if (content.hero) {
      const heroBadge = document.querySelector('.hero-badge span:last-child');
      if (heroBadge && content.hero.badge) heroBadge.textContent = content.hero.badge;

      const heroHeading = document.querySelector('.hero-title');
      if (heroHeading && content.hero.heading) heroHeading.textContent = content.hero.heading;

      const heroLead = document.querySelector('.hero-lead');
      if (heroLead && content.hero.lead) heroLead.textContent = content.hero.lead;

      const heroPrimaryBtn = document.querySelector('.hero-actions .btn-primary span');
      if (heroPrimaryBtn && content.hero.btn_primary) heroPrimaryBtn.textContent = content.hero.btn_primary;

      const heroSecondaryBtn = document.querySelector('.hero-actions .btn-outline span');
      if (heroSecondaryBtn && content.hero.btn_secondary) heroSecondaryBtn.textContent = content.hero.btn_secondary;
    }

    // 2. About Us
    if (content.about) {
      const aboutTitle = document.querySelector('#about .section-title');
      if (aboutTitle && content.about.title) aboutTitle.textContent = content.about.title;

      const aboutLead = document.querySelector('.about-lead-text');
      if (aboutLead && content.about.lead) aboutLead.textContent = content.about.lead;

      const aboutDesc = document.querySelector('.about-story-text');
      if (aboutDesc && content.about.description) aboutDesc.textContent = content.about.description;

      const statNum = document.querySelector('.about-stat-number');
      if (statNum && content.about.stats_number) statNum.textContent = content.about.stats_number;

      const statLabel = document.querySelector('.about-visual-card h3');
      if (statLabel && content.about.stats_label) statLabel.textContent = content.about.stats_label;
    }

    // 3. How It Works
    if (content.how_it_works && content.how_it_works.steps) {
      const howTitle = document.querySelector('#how-it-works .section-title');
      if (howTitle && content.how_it_works.title) howTitle.textContent = content.how_it_works.title;

      const howSubtitle = document.querySelector('#how-it-works .section-subtitle');
      if (howSubtitle && content.how_it_works.subtitle) howSubtitle.textContent = content.how_it_works.subtitle;

      const stepCards = document.querySelectorAll('.step-card');
      content.how_it_works.steps.forEach((step, idx) => {
        if (stepCards[idx]) {
          const titleEl = stepCards[idx].querySelector('h3');
          const descEl = stepCards[idx].querySelector('p');
          if (titleEl && step.title) titleEl.textContent = step.title;
          if (descEl && step.desc) descEl.textContent = step.desc;
        }
      });
    }

    // 4. Why Choose Us
    if (content.why_us && content.why_us.points) {
      const whyTitle = document.querySelector('#why-us .section-title');
      if (whyTitle && content.why_us.title) whyTitle.textContent = content.why_us.title;

      const whySubtitle = document.querySelector('#why-us .section-subtitle');
      if (whySubtitle && content.why_us.subtitle) whySubtitle.textContent = content.why_us.subtitle;

      const trustCards = document.querySelectorAll('.trust-point-card');
      content.why_us.points.forEach((point, idx) => {
        if (trustCards[idx]) {
          const titleEl = trustCards[idx].querySelector('h3');
          const descEl = trustCards[idx].querySelector('p');
          if (titleEl && point.title) titleEl.textContent = point.title;
          if (descEl && point.desc) descEl.textContent = point.desc;
        }
      });
    }

    // 5. CTA Banner & Footer
    if (content.cta) {
      const ctaTitle = document.querySelector('.cta-banner-content h2');
      if (ctaTitle && content.cta.title) ctaTitle.textContent = content.cta.title;

      const ctaDesc = document.querySelector('.cta-banner-content p');
      if (ctaDesc && content.cta.description) ctaDesc.textContent = content.cta.description;

      const ctaBtn = document.querySelector('.cta-banner-content .btn span');
      if (ctaBtn && content.cta.btn_text) ctaBtn.textContent = content.cta.btn_text;
    }

    if (content.footer) {
      const footerDesc = document.querySelector('.footer-brand p');
      if (footerDesc && content.footer.description) footerDesc.textContent = content.footer.description;

      const footerCopy = document.querySelector('.footer-bottom-copy');
      if (footerCopy && content.footer.copyright) footerCopy.textContent = content.footer.copyright;
    }
  }
}

/**
 * Render Vehicle Cards into the Catalog Grid
 */
function renderVehicleCatalog(filter = 'all') {
  const container = document.getElementById('vehiclesGrid');
  if (!container || typeof VEHICLES_DATA === 'undefined') return;

  const filtered = filter === 'all'
    ? VEHICLES_DATA
    : VEHICLES_DATA.filter(v => v.category === filter || (filter === 'heavy' && (v.category === 'heavy' || v.category === 'container')));

  if (filtered.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No vehicles found in this category.</p>`;
    return;
  }

  container.innerHTML = filtered.map(v => {
    const bestForItems = Array.isArray(v.bestFor) ? v.bestFor : (typeof v.bestFor === 'string' ? JSON.parse(v.bestFor || '[]') : []);
    const badgeText = v.badge || (v.category === 'pickup' ? 'Popular' : 'Verified');
    const isGoldBadge = badgeText.toLowerCase().includes('popular') || badgeText.toLowerCase().includes('demand') || badgeText.toLowerCase().includes('value');

    return `
    <div class="vehicle-card" id="vehicle-card-${v.id}">
      <div class="vehicle-card-img-wrap">
        <img src="${v.image}" alt="${v.name} - Vandi Load" loading="lazy" onerror="this.src='assets/images/vehicles/mini-pickup.jpg'" />
        <span class="badge vehicle-card-badge ${isGoldBadge ? 'badge-gold' : 'badge-green'}">
          ${badgeText}
        </span>
      </div>
      
      <div class="vehicle-card-body">
        <div class="vehicle-title-wrap">
          <h3 class="vehicle-name">${v.name}</h3>
        </div>

        <div class="vehicle-specs">
          <div class="spec-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
            <strong>${v.capacityKg}</strong>
          </div>
          <div class="spec-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            <span>${v.capacityBoxes}</span>
          </div>
          ${v.bedSize ? `
          <div class="spec-chip" style="width: 100%;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.19M15 6h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3.19"/></svg>
            <span>${v.bedSize}</span>
          </div>` : ''}
        </div>

        ${bestForItems.length > 0 ? `
        <div class="vehicle-best-for">
          <div class="best-for-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
            Best For:
          </div>
          <div class="best-for-list">
            ${bestForItems.map(item => `<div class="best-for-item">${item}</div>`).join('')}
          </div>
        </div>` : ''}

        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 18px; line-height: 1.45;">
          ${v.description || ''}
        </p>

        <div class="vehicle-card-footer">
          <button class="btn btn-primary btn-block" onclick="openGetVehicleModal('${v.id}')">
            <span>Ask for This Vehicle</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
    </div>
    `;
  }).join('');
}
