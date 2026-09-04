/**
 * Vandi Load - Gallery & Lightbox Viewer
 * Dynamically fetches photos from the database with category filtering and zoom lightbox.
 */

let GALLERY_DATA = [
  {
    title: "Mini Pickup - Local City Goods Delivery",
    category: "pickup",
    src: "assets/images/vehicles/mini-pickup.jpg"
  },
  {
    title: "Small Pickup - Loaded Carton Boxes",
    category: "pickup",
    src: "assets/images/vehicles/small-pickup.jpg"
  },
  {
    title: "Pickup Truck - Industrial Wholesale Transport",
    category: "pickup",
    src: "assets/images/vehicles/pickup-truck.jpg"
  },
  {
    title: "14 Feet Truck - Warehouse Loading Bay",
    category: "medium",
    src: "assets/images/vehicles/14ft-truck.jpg"
  },
  {
    title: "17 Feet Truck - Heavy Tarpaulin Cargo",
    category: "medium",
    src: "assets/images/vehicles/17ft-truck.jpg"
  },
  {
    title: "20 Feet Multi-Axle - Intercity Volume Carrier",
    category: "heavy",
    src: "assets/images/vehicles/20ft-truck.jpg"
  },
  {
    title: "Enclosed Container - Secure Weatherproof Transport",
    category: "heavy",
    src: "assets/images/vehicles/container-truck.jpg"
  },
  {
    title: "Open Flatbed Carrier - Machinery & Heavy Goods",
    category: "special",
    src: "assets/images/vehicles/other-vehicles.jpg"
  }
];

async function loadLiveGallery() {
  if (typeof ClientAPI !== 'undefined') {
    const live = await ClientAPI.getGallery();
    if (live && live.length > 0) {
      GALLERY_DATA = live;
    }
  }
  return GALLERY_DATA;
}

async function renderGallery(filter = 'all') {
  const container = document.getElementById('galleryGrid');
  if (!container) return;

  const data = GALLERY_DATA;
  const filtered = filter === 'all' 
    ? data 
    : data.filter(item => item.category === filter || (filter === 'heavy' && item.category === 'container'));

  if (filtered.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No photos found in this category.</p>`;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div class="gallery-item" onclick="openLightbox('${item.src}', '${item.title.replace(/'/g, "\\'")}')">
      <img src="${item.src}" alt="${item.title}" loading="lazy" onerror="this.src='assets/images/vehicles/mini-pickup.jpg'" />
      <div class="gallery-overlay">
        <h4>${item.title}</h4>
        <p>Click to zoom photo</p>
      </div>
    </div>
  `).join('');
}

function openLightbox(src, title) {
  let modal = document.getElementById('galleryLightboxModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'galleryLightboxModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-container" style="max-width: 800px; padding: 0; background: #000000; overflow: hidden;">
        <div style="position: relative;">
          <button class="modal-close-btn" style="position: absolute; top: 16px; right: 16px; z-index: 10; background: rgba(0,0,0,0.6);" onclick="closeModal('galleryLightboxModal')">✕</button>
          <img id="lightboxImg" src="" alt="" style="width: 100%; max-height: 75vh; object-fit: contain;" />
          <div id="lightboxCaption" style="padding: 16px 24px; color: #ffffff; font-weight: 600; font-size: 1rem; background: #0d131f;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal('galleryLightboxModal');
    });
  }

  const img = document.getElementById('lightboxImg');
  const caption = document.getElementById('lightboxCaption');
  if (img) img.src = src;
  if (caption) caption.textContent = title;

  openModal('galleryLightboxModal');
}
