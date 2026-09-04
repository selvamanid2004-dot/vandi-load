/**
 * Vandi Load - Modals & Form Handlers
 * Connects Customer Load Requests, Driver Applications, and Contact forms to the backend database.
 */

// Global state
let currentOpenModal = null;
let pickupMapPicker = null;
let dropMapPicker = null;

// Initialize pickup and delivery location map helpers
function initLocationMaps() {
  if (typeof MapHelper === 'undefined' || typeof L === 'undefined') return;

  // 1. Pickup Map Picker
  const pickupContainer = document.getElementById('reqPickupMapContainer');
  if (pickupContainer && !pickupMapPicker) {
    pickupMapPicker = MapHelper.createPickupPicker('reqPickupMapContainer', {
      initialLat: 11.0168,
      initialLng: 76.9558,
      label: 'Selected Pickup Location',
      markerColor: '#22c55e',
      onLocationSelected: ({ lat, lng, address, details }) => {
        const latInput = document.getElementById('reqPickupLatitude');
        const lngInput = document.getElementById('reqPickupLongitude');
        if (latInput) latInput.value = lat;
        if (lngInput) lngInput.value = lng;

        const badge = document.getElementById('reqPickupLocationBadge');
        if (badge) {
          badge.innerHTML = `<span>📍 Selected Pin: <strong>${lat.toFixed(5)}, ${lng.toFixed(5)}</strong> ${address ? `(${address})` : ''}</span>`;
        }

        // When user moves pin or selects location, update address field if available
        if (address) {
          const addrInput = document.getElementById('reqPickupAddress');
          if (addrInput) {
            addrInput.value = address;
          }
        }
        if (details && details.city) {
          const cityInput = document.getElementById('reqPickupCity');
          if (cityInput && !cityInput.value.trim()) {
            cityInput.value = details.city;
          }
        }
      }
    });
  }

  // 2. Delivery Destination Map Picker (Independent)
  const dropContainer = document.getElementById('reqDropMapContainer');
  if (dropContainer && !dropMapPicker) {
    dropMapPicker = MapHelper.createDeliveryPicker('reqDropMapContainer', {
      initialLat: 13.0827,
      initialLng: 80.2707,
      label: 'Selected Delivery Location',
      markerColor: '#e5a83b',
      onLocationSelected: ({ lat, lng, address, details }) => {
        const latInput = document.getElementById('reqDropLatitude');
        const lngInput = document.getElementById('reqDropLongitude');
        if (latInput) latInput.value = lat;
        if (lngInput) lngInput.value = lng;

        const badge = document.getElementById('reqDropLocationBadge');
        if (badge) {
          badge.innerHTML = `<span>🎯 Selected Pin: <strong>${lat.toFixed(5)}, ${lng.toFixed(5)}</strong> ${address ? `(${address})` : ''}</span>`;
        }

        // When user moves pin or selects location, update address field if available
        if (address) {
          const addrInput = document.getElementById('reqDropAddress');
          if (addrInput) {
            addrInput.value = address;
          }
        }
        if (details && details.city) {
          const cityInput = document.getElementById('reqDropCity');
          if (cityInput && !cityInput.value.trim()) {
            cityInput.value = details.city;
          }
        }
      }
    });
  }
}

function initPickupLocationMap() {
  initLocationMaps();
}

// Open modal helper
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    currentOpenModal = modal;
  }
}

// Close modal helper
function closeModal(modalId) {
  const modal = document.getElementById(modalId) || currentOpenModal;
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    currentOpenModal = null;
  }
}

// Open "Get a Vehicle" modal with preselected vehicle
function openGetVehicleModal(preselectedVehicleId = '') {
  const modal = document.getElementById('getVehicleModal');
  if (!modal) return;

  const vehicleSelect = document.getElementById('reqVehicleType');
  if (vehicleSelect && typeof VEHICLES_DATA !== 'undefined') {
    // Populate select options from live vehicle list
    vehicleSelect.innerHTML = '<option value="">-- Let Vandi Load Team Choose the Best Vehicle --</option>';
    VEHICLES_DATA.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = `${v.name} (${v.capacityKg})`;
      vehicleSelect.appendChild(opt);
    });

    if (preselectedVehicleId) {
      const matched = VEHICLES_DATA.find(v => v.id === preselectedVehicleId || v.name.toLowerCase() === preselectedVehicleId.toLowerCase());
      if (matched) {
        vehicleSelect.value = matched.name;
      }
    }
  }

  openModal('getVehicleModal');

  // Initialize and invalidate size of Leaflet Maps for modal
  setTimeout(() => {
    initLocationMaps();
    if (pickupMapPicker) {
      pickupMapPicker.invalidateSize();
    }
    if (dropMapPicker) {
      dropMapPicker.invalidateSize();
    }
  }, 150);
}

// Open "Join as Driver" modal
function openDriverModal() {
  openModal('joinDriverModal');
}

// Toast notification helper
function showToast(title, message) {
  let toast = document.getElementById('siteToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'siteToast';
    toast.className = 'toast-notification';
    document.body.appendChild(toast);
  }

  toast.innerHTML = `
    <div class="toast-icon">✓</div>
    <div class="toast-content">
      <h5 style="color: #ffffff; font-size: 0.95rem; font-weight: 700; margin-bottom: 2px;">${title}</h5>
      <p style="color: #cbd5e1; font-size: 0.85rem; margin: 0;">${message}</p>
    </div>
  `;

  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 5000);
}

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Bind State & District dropdowns
  if (typeof IndiaLocations !== 'undefined') {
    // 1. Customer Pickup State & District
    IndiaLocations.bindStateDistrictPair('reqPickupState', 'reqPickupDistrict', 'Tamil Nadu', '', null, (district) => {
      if (pickupMapPicker) {
        pickupMapPicker.centerOnDistrict(district);
      }
    });

    // 2. Customer Drop State & District
    IndiaLocations.bindStateDistrictPair('reqDropState', 'reqDropDistrict', 'Tamil Nadu', '', null, (district) => {
      if (dropMapPicker) {
        dropMapPicker.centerOnDistrict(district);
      }
    });

    // 3. Driver State & District
    IndiaLocations.bindStateDistrictPair('driverState', 'driverDistrict', 'Tamil Nadu');
  }

  // Helper to execute and render pickup map search
  async function performMapSearch() {
    const searchInput = document.getElementById('reqMapSearchInput');
    const q = searchInput?.value;
    if (!q || !q.trim()) return;

    const btn = document.getElementById('btnSearchMapLocation');
    const dropdown = document.getElementById('mapSearchResultsDropdown');
    const originalBtnText = btn ? btn.textContent : 'Search';

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Searching...';
    }

    const context = {
      state: document.getElementById('reqPickupState')?.value || '',
      district: document.getElementById('reqPickupDistrict')?.value || '',
      city: document.getElementById('reqPickupCity')?.value || ''
    };

    try {
      const results = await MapHelper.searchAddress(q, context);

      if (results && results.length > 0) {
        if (results.length === 1) {
          // Single match -> select immediately
          if (dropdown) dropdown.style.display = 'none';
          const top = results[0];
          if (pickupMapPicker) {
            pickupMapPicker.centerOn(top.lat, top.lng, 15);
            pickupMapPicker.setLocation(top.lat, top.lng, top.name, true);
          }
        } else {
          // Multiple matches -> render suggestions dropdown
          if (dropdown) {
            dropdown.innerHTML = results.map((item, idx) => `
              <div class="map-search-item" data-idx="${idx}" style="padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; transition: background 0.15s; display: flex; align-items: flex-start; gap: 8px;">
                <span style="font-size: 1.1rem; line-height: 1;">📍</span>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: 0.85rem; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
                  ${item.raw && item.raw.display_name && item.raw.display_name !== item.name ? `<div style="font-size: 0.75rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.raw.display_name}</div>` : ''}
                </div>
              </div>
            `).join('');

            dropdown.style.display = 'block';

            // Attach click listeners to each suggestion
            dropdown.querySelectorAll('.map-search-item').forEach(el => {
              el.addEventListener('mouseenter', () => {
                el.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              });
              el.addEventListener('mouseleave', () => {
                el.style.backgroundColor = 'transparent';
              });
              el.addEventListener('click', () => {
                const idx = parseInt(el.getAttribute('data-idx'), 10);
                const selected = results[idx];
                if (selected && pickupMapPicker) {
                  pickupMapPicker.centerOn(selected.lat, selected.lng, 15);
                  pickupMapPicker.setLocation(selected.lat, selected.lng, selected.name, true);
                  if (searchInput) searchInput.value = selected.name;
                }
                dropdown.style.display = 'none';
              });
            });
          }
        }
      } else {
        if (dropdown) dropdown.style.display = 'none';
        alert('Location not found. Please check the address or select the location on the map.');
      }
    } catch (err) {
      console.error('Search error:', err);
      if (dropdown) dropdown.style.display = 'none';
      alert('Location not found. Please check the address or select the location on the map.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalBtnText;
      }
    }
  }

  // Pickup Map Search button
  document.getElementById('btnSearchMapLocation')?.addEventListener('click', performMapSearch);

  // Pickup Map Search Enter key handling
  document.getElementById('reqMapSearchInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performMapSearch();
    }
  });

  // Close pickup search suggestions dropdown on click outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('mapSearchResultsDropdown');
    const searchInput = document.getElementById('reqMapSearchInput');
    const searchBtn = document.getElementById('btnSearchMapLocation');
    if (dropdown && dropdown.style.display !== 'none') {
      if (!dropdown.contains(e.target) && e.target !== searchInput && e.target !== searchBtn) {
        dropdown.style.display = 'none';
      }
    }
  });

  // "Use My Current Location" button for Pickup
  document.getElementById('btnPickupCurrentLoc')?.addEventListener('click', () => {
    const btn = document.getElementById('btnPickupCurrentLoc');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Locating...</span>';

    MapHelper.getCurrentLocation(
      (pos) => {
        btn.disabled = false;
        btn.innerHTML = originalText;
        if (pickupMapPicker) {
          pickupMapPicker.centerOn(pos.lat, pos.lng, 16);
          pickupMapPicker.setLocation(pos.lat, pos.lng, 'My Current Location');
        }
      },
      (err) => {
        btn.disabled = false;
        btn.innerHTML = originalText;
        alert(err.message || 'Could not fetch current location. You can search or click anywhere on the map.');
      }
    );
  });

  // Helper to execute and render delivery destination map search
  async function performDropMapSearch() {
    const searchInput = document.getElementById('reqDropMapSearchInput');
    const q = searchInput?.value;
    if (!q || !q.trim()) return;

    const btn = document.getElementById('btnSearchDropLocation');
    const dropdown = document.getElementById('dropMapSearchResultsDropdown');
    const originalBtnText = btn ? btn.textContent : 'Search';

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Searching...';
    }

    const context = {
      state: document.getElementById('reqDropState')?.value || '',
      district: document.getElementById('reqDropDistrict')?.value || '',
      city: document.getElementById('reqDropCity')?.value || ''
    };

    try {
      const results = await MapHelper.searchAddress(q, context);

      if (results && results.length > 0) {
        if (results.length === 1) {
          // Single match -> select immediately
          if (dropdown) dropdown.style.display = 'none';
          const top = results[0];
          if (dropMapPicker) {
            dropMapPicker.centerOn(top.lat, top.lng, 15);
            dropMapPicker.setLocation(top.lat, top.lng, top.name, true);
          }
        } else {
          // Multiple matches -> render suggestions dropdown
          if (dropdown) {
            dropdown.innerHTML = results.map((item, idx) => `
              <div class="map-search-item" data-idx="${idx}" style="padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; transition: background 0.15s; display: flex; align-items: flex-start; gap: 8px;">
                <span style="font-size: 1.1rem; line-height: 1;">🎯</span>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: 0.85rem; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
                  ${item.raw && item.raw.display_name && item.raw.display_name !== item.name ? `<div style="font-size: 0.75rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.raw.display_name}</div>` : ''}
                </div>
              </div>
            `).join('');

            dropdown.style.display = 'block';

            // Attach click listeners to each suggestion
            dropdown.querySelectorAll('.map-search-item').forEach(el => {
              el.addEventListener('mouseenter', () => {
                el.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              });
              el.addEventListener('mouseleave', () => {
                el.style.backgroundColor = 'transparent';
              });
              el.addEventListener('click', () => {
                const idx = parseInt(el.getAttribute('data-idx'), 10);
                const selected = results[idx];
                if (selected && dropMapPicker) {
                  dropMapPicker.centerOn(selected.lat, selected.lng, 15);
                  dropMapPicker.setLocation(selected.lat, selected.lng, selected.name, true);
                  if (searchInput) searchInput.value = selected.name;
                }
                dropdown.style.display = 'none';
              });
            });
          }
        }
      } else {
        if (dropdown) dropdown.style.display = 'none';
        alert('Location not found. Please check the address or select the location on the map.');
      }
    } catch (err) {
      console.error('Delivery search error:', err);
      if (dropdown) dropdown.style.display = 'none';
      alert('Location not found. Please check the address or select the location on the map.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalBtnText;
      }
    }
  }

  // Delivery Map Search button
  document.getElementById('btnSearchDropLocation')?.addEventListener('click', performDropMapSearch);

  // Delivery Map Search Enter key handling
  document.getElementById('reqDropMapSearchInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performDropMapSearch();
    }
  });

  // Close delivery search suggestions dropdown on click outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('dropMapSearchResultsDropdown');
    const searchInput = document.getElementById('reqDropMapSearchInput');
    const searchBtn = document.getElementById('btnSearchDropLocation');
    if (dropdown && dropdown.style.display !== 'none') {
      if (!dropdown.contains(e.target) && e.target !== searchInput && e.target !== searchBtn) {
        dropdown.style.display = 'none';
      }
    }
  });

  // "Use My Current Location" button for Delivery Destination
  document.getElementById('btnDropCurrentLoc')?.addEventListener('click', () => {
    const btn = document.getElementById('btnDropCurrentLoc');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Locating...</span>';

    MapHelper.getCurrentLocation(
      (pos) => {
        btn.disabled = false;
        btn.innerHTML = originalText;
        if (dropMapPicker) {
          dropMapPicker.centerOn(pos.lat, pos.lng, 16);
          dropMapPicker.setLocation(pos.lat, pos.lng, 'My Current Location');
        }
      },
      (err) => {
        btn.disabled = false;
        btn.innerHTML = originalText;
        alert(err.message || 'Could not fetch current location. You can search or click anywhere on the map.');
      }
    );
  });

  // Close buttons inside modals
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      if (modal) closeModal(modal.id);
    });
  });

  // Close on backdrop click
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });

  // Handle ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentOpenModal) {
      closeModal(currentOpenModal.id);
    }
  });

  // Handle "Get a Vehicle" Form Submission
  const getVehicleForm = document.getElementById('getVehicleForm');
  if (getVehicleForm) {
    getVehicleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const payload = {
        name: document.getElementById('reqCustomerName')?.value.trim() || '',
        phone: document.getElementById('reqPhone')?.value.trim() || '',
        customerEmail: document.getElementById('reqCustomerEmail')?.value.trim() || '',
        email: document.getElementById('reqCustomerEmail')?.value.trim() || '',
        pickupState: document.getElementById('reqPickupState')?.value || '',
        pickupDistrict: document.getElementById('reqPickupDistrict')?.value || '',
        pickupCity: document.getElementById('reqPickupCity')?.value.trim() || '',
        pickupAddress: document.getElementById('reqPickupAddress')?.value.trim() || '',
        pickupLatitude: document.getElementById('reqPickupLatitude')?.value || null,
        pickupLongitude: document.getElementById('reqPickupLongitude')?.value || null,
        dropState: document.getElementById('reqDropState')?.value || '',
        dropDistrict: document.getElementById('reqDropDistrict')?.value || '',
        dropCity: document.getElementById('reqDropCity')?.value.trim() || '',
        dropAddress: document.getElementById('reqDropAddress')?.value.trim() || '',
        dropLatitude: document.getElementById('reqDropLatitude')?.value || null,
        dropLongitude: document.getElementById('reqDropLongitude')?.value || null,
        deliveryLatitude: document.getElementById('reqDropLatitude')?.value || null,
        deliveryLongitude: document.getElementById('reqDropLongitude')?.value || null,
        goodsCategory: document.getElementById('reqGoodsCategory')?.value || '',
        quantity: document.getElementById('reqQuantityCount')?.value.trim() || '',
        vehiclePreferred: document.getElementById('reqVehicleType')?.value || '',
        message: document.getElementById('reqLoadNotes')?.value.trim() || '',
        subject: 'Vehicle Load Request'
      };

      const submitBtn = document.getElementById('submitVehicleRequestBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Sending request...</span>';
      }

      let res;
      if (typeof ClientAPI !== 'undefined') {
        res = await ClientAPI.submitEnquiry(payload);
      } else {
        res = { success: true, requestCode: 'VL-' + Math.floor(100000 + Math.random() * 900000) };
      }

      closeModal('getVehicleModal');
      getVehicleForm.reset();

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Send Request</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
      }

      if (res && res.success) {
        showToast(
          `Request Sent! (ID: ${res.requestCode})`,
          `Thank you ${payload.name}. Our team has received your request and sent a confirmation to ${payload.customerEmail || 'your email'}.`
        );
      } else {
        showToast('Submission Received', `Thank you ${payload.name}. Our team will call you at ${payload.phone}.`);
      }
    });
  }

  // Driver Document Upload File Pickers & Previews
  const photoInput = document.getElementById('driverPhotoDoc');
  const photoNameLabel = document.getElementById('driverPhotoFileName');
  const photoImgEl = document.getElementById('driverPhotoImg');
  const photoPlaceholderEl = document.getElementById('driverPhotoPlaceholder');
  const licenceInput = document.getElementById('driverLicenceDoc');
  const licenceNameLabel = document.getElementById('driverLicenceFileName');
  const aadhaarInput = document.getElementById('driverAadhaarDoc');
  const aadhaarNameLabel = document.getElementById('driverAadhaarFileName');

  // Inline Validation Helpers for Join Driver Form
  function showFieldError(fieldId, errorId, message) {
    const field = document.getElementById(fieldId);
    const errEl = document.getElementById(errorId);
    if (field) {
      field.style.borderColor = '#ef4444';
      field.style.boxShadow = '0 0 0 1px #ef4444';
    }
    if (errEl) {
      errEl.textContent = message;
      errEl.style.display = 'block';
    }
  }

  function clearFieldError(fieldId, errorId) {
    const field = document.getElementById(fieldId);
    const errEl = document.getElementById(errorId);
    if (field) {
      field.style.borderColor = '';
      field.style.boxShadow = '';
    }
    if (errEl) {
      errEl.textContent = '';
      errEl.style.display = 'none';
    }
  }

  function validateDriverPhone(phoneVal) {
    const digits = (phoneVal || '').replace(/\D/g, '');
    const cleanDigits = (digits.length === 12 && digits.startsWith('91')) ? digits.substring(2) : digits;
    return /^[6-9]\d{9}$/.test(cleanDigits);
  }

  function validateDriverEmail(emailVal) {
    const clean = (emailVal || '').trim().toLowerCase();
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(clean);
  }

  // Real-time input listeners for Join Driver Form
  document.getElementById('driverName')?.addEventListener('input', () => {
    if (document.getElementById('driverName').value.trim()) clearFieldError('driverName', 'driverNameError');
  });

  document.getElementById('driverPhone')?.addEventListener('input', (e) => {
    const val = e.target.value;
    if (validateDriverPhone(val)) {
      clearFieldError('driverPhone', 'driverPhoneError');
    }
  });

  document.getElementById('driverEmail')?.addEventListener('input', (e) => {
    const val = e.target.value;
    if (validateDriverEmail(val)) {
      clearFieldError('driverEmail', 'driverEmailError');
    }
  });

  document.getElementById('driverAddress')?.addEventListener('input', () => {
    if (document.getElementById('driverAddress').value.trim()) clearFieldError('driverAddress', 'driverAddressError');
  });

  document.getElementById('driverCity')?.addEventListener('input', () => {
    if (document.getElementById('driverCity').value.trim()) clearFieldError('driverCity', 'driverCityError');
  });

  document.getElementById('driverVehicleNumber')?.addEventListener('input', () => {
    if (document.getElementById('driverVehicleNumber').value.trim()) clearFieldError('driverVehicleNumber', 'driverVehicleNumberError');
  });

  function validatePhotoFile(file) {
    if (!file) {
      if (photoNameLabel) {
        photoNameLabel.textContent = 'No photo chosen (JPG, PNG max 10MB)';
        photoNameLabel.style.color = 'var(--text-muted)';
      }
      if (photoImgEl) {
        photoImgEl.src = '';
        photoImgEl.style.display = 'none';
      }
      if (photoPlaceholderEl) photoPlaceholderEl.style.display = 'block';
      return false;
    }

    const allowed = /\.(jpg|jpeg|png)$/i;
    if (!allowed.test(file.name)) {
      showFieldError('driverPhotoDoc', 'driverPhotoError', `Invalid format for Driver Photo ("${file.name}"). Only JPG and PNG image files are accepted.`);
      if (photoInput) photoInput.value = '';
      if (photoNameLabel) {
        photoNameLabel.textContent = 'Invalid format. Choose JPG or PNG image.';
        photoNameLabel.style.color = '#ef4444';
      }
      if (photoImgEl) {
        photoImgEl.src = '';
        photoImgEl.style.display = 'none';
      }
      if (photoPlaceholderEl) photoPlaceholderEl.style.display = 'block';
      return false;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      showFieldError('driverPhotoDoc', 'driverPhotoError', `Photo exceeds 10MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose a smaller image.`);
      if (photoInput) photoInput.value = '';
      if (photoNameLabel) {
        photoNameLabel.textContent = 'Photo too large (>10MB). Choose a smaller image.';
        photoNameLabel.style.color = '#ef4444';
      }
      if (photoImgEl) {
        photoImgEl.src = '';
        photoImgEl.style.display = 'none';
      }
      if (photoPlaceholderEl) photoPlaceholderEl.style.display = 'block';
      return false;
    }

    clearFieldError('driverPhotoDoc', 'driverPhotoError');
    const sizeKb = (file.size / 1024).toFixed(0);
    const sizeStr = sizeKb > 1000 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
    if (photoNameLabel) {
      photoNameLabel.textContent = `✔ ${file.name} (${sizeStr})`;
      photoNameLabel.style.color = '#4ade80';
    }

    // Show live preview
    const reader = new FileReader();
    reader.onload = (e) => {
      if (photoImgEl) {
        photoImgEl.src = e.target.result;
        photoImgEl.style.display = 'block';
      }
      if (photoPlaceholderEl) photoPlaceholderEl.style.display = 'none';
    };
    reader.readAsDataURL(file);

    return true;
  }

  photoInput?.addEventListener('change', (e) => {
    validatePhotoFile(e.target.files[0]);
  });

  function validateDocFile(file, labelEl, inputEl, errorId, docLabel) {
    if (!file) {
      if (labelEl) labelEl.textContent = 'No file chosen (JPG, PNG, PDF max 10MB)';
      return false;
    }

    const allowed = /\.(jpg|jpeg|png|pdf)$/i;
    if (!allowed.test(file.name)) {
      if (errorId) showFieldError(inputEl?.id, errorId, `Invalid format for ${docLabel} ("${file.name}"). Only JPG, PNG, or PDF files are accepted.`);
      inputEl.value = '';
      if (labelEl) {
        labelEl.textContent = 'Invalid file format. Choose JPG, PNG, or PDF.';
        labelEl.style.color = '#ef4444';
      }
      return false;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      if (errorId) showFieldError(inputEl?.id, errorId, `${docLabel} exceeds 10MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
      inputEl.value = '';
      if (labelEl) {
        labelEl.textContent = 'File too large (>10MB). Choose a smaller file.';
        labelEl.style.color = '#ef4444';
      }
      return false;
    }

    if (errorId) clearFieldError(inputEl?.id, errorId);
    const sizeKb = (file.size / 1024).toFixed(0);
    const sizeStr = sizeKb > 1000 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
    if (labelEl) {
      labelEl.textContent = `✔ ${file.name} (${sizeStr})`;
      labelEl.style.color = '#4ade80';
    }
    return true;
  }

  licenceInput?.addEventListener('change', (e) => {
    validateDocFile(e.target.files[0], licenceNameLabel, licenceInput, 'driverLicenceError', 'Driving Licence');
  });

  aadhaarInput?.addEventListener('change', (e) => {
    validateDocFile(e.target.files[0], aadhaarNameLabel, aadhaarInput, 'driverAadhaarError', 'Aadhaar Card');
  });

  // Handle "Join as Driver" Form Submission
  const joinDriverForm = document.getElementById('joinDriverForm');
  if (joinDriverForm) {
    joinDriverForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Clear previous global error
      const globalErrorEl = document.getElementById('joinDriverFormGlobalError');
      if (globalErrorEl) {
        globalErrorEl.textContent = '';
        globalErrorEl.style.display = 'none';
      }

      let hasError = false;

      // 1. Full Name
      const nameVal = document.getElementById('driverName')?.value.trim() || '';
      if (!nameVal) {
        showFieldError('driverName', 'driverNameError', 'Driver full name is required.');
        hasError = true;
      } else {
        clearFieldError('driverName', 'driverNameError');
      }

      // 2. Mobile Number (10 digits starting with 6-9)
      const phoneVal = document.getElementById('driverPhone')?.value.trim() || '';
      if (!phoneVal) {
        showFieldError('driverPhone', 'driverPhoneError', 'Mobile number is required.');
        hasError = true;
      } else if (!validateDriverPhone(phoneVal)) {
        showFieldError('driverPhone', 'driverPhoneError', 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
        hasError = true;
      } else {
        clearFieldError('driverPhone', 'driverPhoneError');
      }

      // 3. Email Address
      const emailVal = document.getElementById('driverEmail')?.value.trim() || '';
      if (!emailVal) {
        showFieldError('driverEmail', 'driverEmailError', 'Email address is required.');
        hasError = true;
      } else if (!validateDriverEmail(emailVal)) {
        showFieldError('driverEmail', 'driverEmailError', 'Please enter a valid email address (e.g. name@gmail.com).');
        hasError = true;
      } else {
        clearFieldError('driverEmail', 'driverEmailError');
      }

      // 4. Address
      const addressVal = document.getElementById('driverAddress')?.value.trim() || '';
      if (!addressVal) {
        showFieldError('driverAddress', 'driverAddressError', 'Residential or operating address is required.');
        hasError = true;
      } else {
        clearFieldError('driverAddress', 'driverAddressError');
      }

      // 5. Operating City
      const cityVal = document.getElementById('driverCity')?.value.trim() || '';
      if (!cityVal) {
        showFieldError('driverCity', 'driverCityError', 'Operating city / area is required.');
        hasError = true;
      } else {
        clearFieldError('driverCity', 'driverCityError');
      }

      // 6. Vehicle Type & Number
      const vehicleTypeVal = document.getElementById('driverVehicleType')?.value || '';
      if (!vehicleTypeVal) {
        showFieldError('driverVehicleType', 'driverVehicleTypeError', 'Vehicle type is required.');
        hasError = true;
      } else {
        clearFieldError('driverVehicleType', 'driverVehicleTypeError');
      }

      const vehicleNumberVal = document.getElementById('driverVehicleNumber')?.value.trim() || '';
      if (!vehicleNumberVal) {
        showFieldError('driverVehicleNumber', 'driverVehicleNumberError', 'Vehicle registration number is required.');
        hasError = true;
      } else {
        clearFieldError('driverVehicleNumber', 'driverVehicleNumberError');
      }

      // 7. Documents
      const photoFile = photoInput?.files[0];
      const licenceFile = licenceInput?.files[0];
      const aadhaarFile = aadhaarInput?.files[0];

      if (!photoFile) {
        showFieldError('driverPhotoDoc', 'driverPhotoError', 'Driver Photo is required (JPG or PNG).');
        hasError = true;
      } else if (!validatePhotoFile(photoFile)) {
        hasError = true;
      }

      if (!licenceFile) {
        showFieldError('driverLicenceDoc', 'driverLicenceError', 'Driving Licence document is required (JPG, PNG, or PDF).');
        hasError = true;
      } else if (!validateDocFile(licenceFile, licenceNameLabel, licenceInput, 'driverLicenceError', 'Driving Licence')) {
        hasError = true;
      }

      if (!aadhaarFile) {
        showFieldError('driverAadhaarDoc', 'driverAadhaarError', 'ID Proof: Aadhaar Card document is required (JPG, PNG, or PDF).');
        hasError = true;
      } else if (!validateDocFile(aadhaarFile, aadhaarNameLabel, aadhaarInput, 'driverAadhaarError', 'Aadhaar Card')) {
        hasError = true;
      }

      if (hasError) {
        if (globalErrorEl) {
          globalErrorEl.textContent = 'Please fill out all mandatory fields and upload required documents correctly.';
          globalErrorEl.style.display = 'block';
        }
        return;
      }

      const stateVal = document.getElementById('driverState')?.value || '';
      const districtVal = document.getElementById('driverDistrict')?.value || '';

      const formData = new FormData();
      formData.append('fullName', nameVal);
      formData.append('phone', phoneVal);
      formData.append('email', emailVal);
      formData.append('address', addressVal);
      formData.append('state', stateVal);
      formData.append('district', districtVal);
      formData.append('location', cityVal);
      formData.append('vehicleType', vehicleTypeVal);
      formData.append('vehicleNumber', vehicleNumberVal);
      formData.append('experience', document.getElementById('driverExperience')?.value || '0');
      formData.append('driverPhoto', photoFile);
      formData.append('drivingLicence', licenceFile);
      formData.append('aadhaarCard', aadhaarFile);

      const submitBtn = document.getElementById('submitDriverRequestBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Uploading photo & documents...</span>';
      }

      try {
        let res;
        if (typeof ClientAPI !== 'undefined') {
          res = await ClientAPI.submitDriverApplication(formData);
        } else {
          res = { success: true };
        }

        if (res && res.success) {
          closeModal('joinDriverModal');
          joinDriverForm.reset();
          if (photoNameLabel) {
            photoNameLabel.textContent = 'No photo chosen (JPG, PNG max 10MB)';
            photoNameLabel.style.color = 'var(--text-muted)';
          }
          if (photoImgEl) {
            photoImgEl.src = '';
            photoImgEl.style.display = 'none';
          }
          if (photoPlaceholderEl) photoPlaceholderEl.style.display = 'block';

          if (licenceNameLabel) {
            licenceNameLabel.textContent = 'No file chosen (JPG, PNG, PDF max 10MB)';
            licenceNameLabel.style.color = 'var(--text-muted)';
          }
          if (aadhaarNameLabel) {
            aadhaarNameLabel.textContent = 'No file chosen (JPG, PNG, PDF max 10MB)';
            aadhaarNameLabel.style.color = 'var(--text-muted)';
          }

          showToast(
            'Registration Submitted Successfully!',
            `Thank you ${formData.get('fullName')}. Your driver photo, registration, and documents have been saved securely. Our operations team will verify your credentials and approve your account.`
          );
        } else {
          const errMsg = res?.message || 'Failed to submit driver registration. Please check your details.';
          if (globalErrorEl) {
            globalErrorEl.textContent = errMsg;
            globalErrorEl.style.display = 'block';
          }
          if (errMsg.toLowerCase().includes('mobile') || errMsg.toLowerCase().includes('phone')) {
            showFieldError('driverPhone', 'driverPhoneError', errMsg);
          } else if (errMsg.toLowerCase().includes('email')) {
            showFieldError('driverEmail', 'driverEmailError', errMsg);
          }
          showToast('Registration Error', errMsg);
        }
      } catch (err) {
        console.error('Driver submission error:', err);
        const errMsg = err.message || 'Submission failed. Please try again.';
        if (globalErrorEl) {
          globalErrorEl.textContent = errMsg;
          globalErrorEl.style.display = 'block';
        }
        if (errMsg.toLowerCase().includes('mobile') || errMsg.toLowerCase().includes('phone')) {
          showFieldError('driverPhone', 'driverPhoneError', errMsg);
        } else if (errMsg.toLowerCase().includes('email')) {
          showFieldError('driverEmail', 'driverEmailError', errMsg);
        }
        showToast('Registration Error', errMsg);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Register Driver</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
        }
      }
    });
  }

  // Handle Contact Form Submission
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const payload = {
        name: document.getElementById('contactName')?.value.trim() || '',
        phone: document.getElementById('contactPhone')?.value.trim() || '',
        subject: document.getElementById('contactSubject')?.value.trim() || 'General Enquiry',
        message: document.getElementById('contactMessage')?.value.trim() || ''
      };

      if (typeof ClientAPI !== 'undefined') {
        await ClientAPI.submitEnquiry(payload);
      }

      contactForm.reset();
      showToast(
        'Message Received!',
        `Thank you ${payload.name}. We have received your message and will get back to you shortly.`
      );
    });
  }
});
