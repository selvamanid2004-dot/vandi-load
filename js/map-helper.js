/**
 * Vandi Load - Map Helper Library (Leaflet + OpenStreetMap)
 * Production-ready, responsive, lightweight map component.
 * Zero external private API keys required.
 */

const MapHelper = {
  // Default fallback center: Tamil Nadu / South India coordinates
  DEFAULT_CENTER: [11.1271, 78.6569],
  DEFAULT_ZOOM: 7,

  // Approximate coordinate centers for key Indian States and Tamil Nadu districts for quick map snapping
  DISTRICT_COORDINATES: {
    "Chennai": [13.0827, 80.2707],
    "Coimbatore": [11.0168, 76.9558],
    "Madurai": [9.9252, 78.1198],
    "Tiruchirappalli (Trichy)": [10.7905, 78.7047],
    "Salem": [11.6643, 78.1460],
    "Tiruppur": [11.1085, 77.3411],
    "Erode": [11.3410, 77.7172],
    "Vellore": [12.9165, 79.1325],
    "Tirunelveli": [8.7139, 77.7567],
    "Thoothukudi (Tuticorin)": [8.7642, 78.1348],
    "Dindigul": [10.3673, 77.9803],
    "Thanjavur": [10.7870, 79.1378],
    "Ranipet": [12.9272, 79.3330],
    "Kanchipuram": [12.8342, 79.7036],
    "Chengalpattu": [12.6841, 79.9836],
    "Tiruvallur": [13.1432, 79.9074],
    "Tiruvannamalai": [12.2253, 79.0747],
    "Viluppuram": [11.9401, 79.4861],
    "Kallakurichi": [11.7384, 78.9639],
    "Cuddalore": [11.7480, 79.7714],
    "Dharmapuri": [12.1211, 78.1582],
    "Krishnagiri": [12.5186, 78.2138],
    "Namakkal": [11.2189, 78.1674],
    "Karur": [10.9601, 78.0766],
    "Perambalur": [11.2342, 78.8820],
    "Ariyalur": [11.1401, 79.0786],
    "Pudukkottai": [10.3797, 78.8208],
    "Sivaganga": [9.8433, 78.4809],
    "Ramanathapuram": [9.3639, 78.8395],
    "Virudhunagar": [9.5872, 77.9579],
    "Theni": [10.0104, 77.4768],
    "Tenkasi": [8.9594, 77.3152],
    "Kanyakumari": [8.0883, 77.5385],
    "Nilgiris": [11.4102, 76.6950],
    "Bengaluru (Bangalore) Urban": [12.9716, 77.5946],
    "Ernakulam": [9.9816, 76.2999],
    "Hyderabad": [17.3850, 78.4867],
    "Mumbai City": [19.0760, 72.8777]
  },

  /**
   * Helper to parse explicit coordinates from user input (e.g. "13.0827, 80.2707")
   */
  parseCoordinates(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    const coordRegex = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)[,\s]+[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
    if (coordRegex.test(trimmed)) {
      const parts = trimmed.split(/[,\s]+/).filter(Boolean);
      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { lat, lng, name: `Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}` };
        }
      }
    }
    return null;
  },

  /**
   * Helper to parse Google Maps URLs containing coordinates or place queries
   */
  parseGoogleMapsUrl(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return null;
    const str = urlStr.trim();
    if (!str.includes('google.com') && !str.includes('goo.gl') && !str.includes('maps.app.goo.gl')) {
      return null;
    }

    // 1. Coordinates after @ e.g. /@13.0827,80.2707,17z
    const atMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      const lat = parseFloat(atMatch[1]);
      const lng = parseFloat(atMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng, name: `Google Maps Location (${lat.toFixed(6)}, ${lng.toFixed(6)})` };
      }
    }

    // 2. Coordinates in query string (?q=lat,lng, ?query=lat,lng, ?ll=lat,lng, ?daddr=lat,lng)
    const qMatch = str.match(/[?&](?:q|query|ll|daddr)=(?:loc:)?(-?\d+\.\d+)[,+]+(-?\d+\.\d+)/i);
    if (qMatch) {
      const lat = parseFloat(qMatch[1]);
      const lng = parseFloat(qMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng, name: `Google Maps Location (${lat.toFixed(6)}, ${lng.toFixed(6)})` };
      }
    }

    // 3. Place query string in URL e.g. /place/Chennai+Central+Railway+Station/...
    const placeMatch = str.match(/\/place\/([^/@?]+)/);
    if (placeMatch) {
      const placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
      return { query: placeName };
    }

    return null;
  },

  /**
   * Initialize interactive customer pickup location picker map
   */
  createPickupPicker(containerId, options = {}) {
    if (typeof L === 'undefined') {
      console.warn('Leaflet (L) library not loaded yet');
      return null;
    }

    const container = document.getElementById(containerId);
    if (!container) return null;

    // Check if map already initialized on this container
    if (container._leaflet_map) {
      container._leaflet_map.remove();
      container._leaflet_map = null;
    }

    const initialLat = options.initialLat || this.DEFAULT_CENTER[0];
    const initialLng = options.initialLng || this.DEFAULT_CENTER[1];
    const initialZoom = options.initialZoom || (options.initialLat ? 15 : this.DEFAULT_ZOOM);
    const locationLabel = options.label || 'Selected Location';
    const markerColor = options.markerColor || '#22c55e';

    const map = L.map(containerId, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: true,
      attributionControl: false
    });
    container._leaflet_map = map;

    // OpenStreetMap standard tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Custom styled icon for location marker
    const locationIcon = L.divIcon({
      className: 'vandi-location-marker',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background: ${markerColor};
          border: 3px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="width: 10px; height: 10px; background: #ffffff; border-radius: 50%;"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });

    let marker = null;
    if (options.initialLat && options.initialLng) {
      marker = L.marker([options.initialLat, options.initialLng], {
        draggable: true,
        icon: locationIcon
      }).addTo(map);
      marker.bindPopup(`<b>${locationLabel}</b>`).openPopup();
    }

    async function setLocation(lat, lng, addressText = '', skipReverse = false) {
      lat = parseFloat(Number(lat).toFixed(6));
      lng = parseFloat(Number(lng).toFixed(6));

      if (marker) {
        marker.setLatLng([lat, lng]);
      } else {
        marker = L.marker([lat, lng], { draggable: true, icon: locationIcon }).addTo(map);
        marker.on('dragend', async () => {
          const pos = marker.getLatLng();
          await setLocation(pos.lat, pos.lng);
        });
      }

      let finalAddress = addressText;
      let addressDetails = null;

      if (!finalAddress && !skipReverse) {
        marker.bindPopup(`<b>${locationLabel}:</b><br/>📍 Resolving address...`).openPopup();
        try {
          const rev = await MapHelper.reverseGeocode(lat, lng);
          if (rev && rev.displayName) {
            finalAddress = rev.displayName;
            addressDetails = rev.details;
          }
        } catch (e) {
          console.warn('Reverse geocoding warning:', e);
        }
      }

      marker.bindPopup(`<b>${locationLabel}:</b><br/>${finalAddress || `${lat}, ${lng}`}`).openPopup();

      if (typeof options.onLocationSelected === 'function') {
        options.onLocationSelected({ lat, lng, address: finalAddress, details: addressDetails });
      }
    }

    // Map click sets location
    map.on('click', async (e) => {
      await setLocation(e.latlng.lat, e.latlng.lng);
    });

    if (marker) {
      marker.on('dragend', async () => {
        const pos = marker.getLatLng();
        await setLocation(pos.lat, pos.lng);
      });
    }

    return {
      map,
      marker,
      setLocation,
      centerOn(lat, lng, zoom = 15) {
        map.setView([lat, lng], zoom);
      },
      centerOnDistrict(districtName) {
        if (MapHelper.DISTRICT_COORDINATES[districtName]) {
          const [dLat, dLng] = MapHelper.DISTRICT_COORDINATES[districtName];
          map.setView([dLat, dLng], 12);
        }
      },
      invalidateSize() {
        setTimeout(() => map.invalidateSize(), 200);
      }
    };
  },

  /**
   * Initialize interactive customer delivery destination picker map (reuses createPickupPicker)
   */
  createDeliveryPicker(containerId, options = {}) {
    return this.createPickupPicker(containerId, {
      label: 'Selected Delivery Location',
      markerColor: '#e5a83b',
      ...options
    });
  },

  /**
   * Generalized location picker
   */
  createLocationPicker(containerId, options = {}) {
    return this.createPickupPicker(containerId, options);
  },

  /**
   * Render read-only view map for Driver and Admin portals
   */
  renderReadOnlyMap(containerId, lat, lng, popupText = 'Pickup Location') {
    if (typeof L === 'undefined') return null;
    const container = document.getElementById(containerId);
    if (!container) return null;

    if (container._leaflet_map) {
      container._leaflet_map.remove();
      container._leaflet_map = null;
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) return null;

    const map = L.map(containerId, {
      center: [latitude, longitude],
      zoom: 15,
      zoomControl: true,
      attributionControl: false
    });
    container._leaflet_map = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    const pickupIcon = L.divIcon({
      className: 'vandi-pickup-marker',
      html: `
        <div style="
          width: 34px;
          height: 34px;
          background: #22c55e;
          border: 3px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="width: 10px; height: 10px; background: #ffffff; border-radius: 50%;"></div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -34]
    });

    const marker = L.marker([latitude, longitude], { icon: pickupIcon }).addTo(map);
    marker.bindPopup(`<b>${popupText}</b><br/>Coordinates: ${latitude}, ${longitude}`).openPopup();

    setTimeout(() => map.invalidateSize(), 250);
    return map;
  },

  /**
   * Geolocation helper (Use my current location)
   */
  getCurrentLocation(onSuccess, onError) {
    if (!navigator.geolocation) {
      if (typeof onError === 'function') onError(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (typeof onSuccess === 'function') {
          onSuccess({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        }
      },
      (err) => {
        let msg = 'Could not fetch your location.';
        if (err.code === 1) msg = 'Location access permission was denied. You can search or pin your location on the map.';
        else if (err.code === 2) msg = 'Location position unavailable. Please search or pin your location on the map.';
        else if (err.code === 3) msg = 'Location request timed out.';
        if (typeof onError === 'function') onError(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  },

  /**
   * Comprehensive Geocoding Search (Multi-Strategy, Typo-Tolerant, India Prioritized)
   */
  async searchAddress(query, context = {}) {
    if (!query || !query.trim()) return [];
    const clean = query.trim();

    // Strategy 1: Direct Latitude, Longitude (e.g. "13.0827, 80.2707")
    const coordResult = this.parseCoordinates(clean);
    if (coordResult) {
      return [{
        name: coordResult.name,
        lat: coordResult.lat,
        lng: coordResult.lng,
        isCoords: true
      }];
    }

    // Strategy 2: Google Maps URL parsing
    const gmapResult = this.parseGoogleMapsUrl(clean);
    if (gmapResult) {
      if (gmapResult.lat && gmapResult.lng) {
        return [{
          name: gmapResult.name,
          lat: gmapResult.lat,
          lng: gmapResult.lng,
          isGmaps: true
        }];
      }
      if (gmapResult.query) {
        return this.searchAddress(gmapResult.query, context);
      }
    }

    const isPincode = /^\d{6}$/.test(clean);

    // Strategy 3: OpenStreetMap Nominatim with India countrycode preference
    let nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&limit=6&countrycodes=in&addressdetails=1`;
    if (isPincode) {
      nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&postalcode=${clean}&country=India&limit=6&addressdetails=1`;
    }

    try {
      const res = await fetch(nominatimUrl, {
        headers: { 'Accept-Language': 'en' }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map(item => ({
            name: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            address: item.address
          }));
        }
      }
    } catch (e) {
      console.warn('Nominatim primary search error:', e);
    }

    // Strategy 4: Contextual fallback with selected District / State
    if (context.district || context.state) {
      const parts = [clean];
      if (context.district && !clean.toLowerCase().includes(context.district.toLowerCase())) {
        parts.push(context.district);
      }
      if (context.state && !clean.toLowerCase().includes(context.state.toLowerCase())) {
        parts.push(context.state);
      }
      parts.push('India');
      const contextualQuery = parts.join(', ');

      try {
        const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(contextualQuery)}&limit=6&countrycodes=in&addressdetails=1`;
        const res = await fetch(fallbackUrl, { headers: { 'Accept-Language': 'en' } });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            return data.map(item => ({
              name: item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              address: item.address
            }));
          }
        }
      } catch (e) {
        console.warn('Nominatim contextual search error:', e);
      }
    }

    // Strategy 5: Photon OSM typeahead geocoder fallback (fuzzy match)
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(clean)}&limit=6&lat=13.08&lon=80.27`;
      const res = await fetch(photonUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.features) && data.features.length > 0) {
          return data.features.map(f => {
            const p = f.properties || {};
            const nameParts = [p.name, p.street, p.district, p.city, p.state, p.country].filter(Boolean);
            return {
              name: nameParts.join(', ') || p.name || clean,
              lat: f.geometry.coordinates[1],
              lng: f.geometry.coordinates[0],
              address: p
            };
          });
        }
      }
    } catch (e) {
      console.warn('Photon fallback error:', e);
    }

    // Strategy 6: Local known district/city dictionary fallback
    const matchedDistrict = Object.keys(this.DISTRICT_COORDINATES).find(d => 
      clean.toLowerCase() === d.toLowerCase() ||
      clean.toLowerCase().includes(d.toLowerCase()) ||
      d.toLowerCase().includes(clean.toLowerCase())
    );
    if (matchedDistrict) {
      const [dLat, dLng] = this.DISTRICT_COORDINATES[matchedDistrict];
      return [{
        name: `${matchedDistrict}, Tamil Nadu, India`,
        lat: dLat,
        lng: dLng,
        isDistrict: true
      }];
    }

    return [];
  },

  /**
   * Reverse Geocode (Coordinates -> Human-Readable Address)
   */
  async reverseGeocode(lat, lng) {
    const latitude = parseFloat(Number(lat).toFixed(6));
    const longitude = parseFloat(Number(lng).toFixed(6));
    if (isNaN(latitude) || isNaN(longitude)) return null;

    // 1. Nominatim Reverse Geocoding
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'VandiLoadWeb/1.0'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.address || data.display_name)) {
          const addr = data.address || {};
          const streetOrPlace = addr.road || addr.suburb || addr.neighbourhood || addr.amenity || addr.building || '';
          const cityOrTown = addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
          const district = addr.state_district || addr.county || '';
          const state = addr.state || '';
          const postcode = addr.postcode || '';

          const summaryParts = [streetOrPlace, cityOrTown, district, state, postcode].filter(Boolean);
          const display = summaryParts.join(', ') || data.display_name || `${latitude}, ${longitude}`;

          return {
            address: display,
            displayName: display,
            fullDisplayName: data.display_name || display,
            formatted: display,
            details: {
              road: addr.road || '',
              neighbourhood: addr.neighbourhood || addr.suburb || '',
              city: cityOrTown,
              district: district,
              state: state,
              postcode: postcode
            }
          };
        }
      }
    } catch (e) {
      console.warn('Nominatim reverse geocode error:', e);
    }

    // 2. Photon Reverse Geocode Fallback
    try {
      const photonRevUrl = `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}`;
      const res = await fetch(photonRevUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.features) && data.features.length > 0) {
          const p = data.features[0].properties || {};
          const nameParts = [p.name, p.street, p.district, p.city, p.state, p.country].filter(Boolean);
          const display = nameParts.join(', ') || p.name || `${latitude}, ${longitude}`;
          return {
            address: display,
            displayName: display,
            fullDisplayName: display,
            formatted: display,
            details: {
              road: p.street || '',
              neighbourhood: p.name || '',
              city: p.city || '',
              district: p.district || '',
              state: p.state || '',
              postcode: p.postcode || ''
            }
          };
        }
      }
    } catch (e) {
      console.warn('Photon reverse geocode error:', e);
    }

    // 3. Fallback to Nearest Known District Coordinate
    let closestDistrict = null;
    let minDistance = Infinity;
    for (const [distName, [dLat, dLng]] of Object.entries(this.DISTRICT_COORDINATES)) {
      const dist = Math.hypot(latitude - dLat, longitude - dLng);
      if (dist < minDistance) {
        minDistance = dist;
        closestDistrict = distName;
      }
    }

    const fallbackName = closestDistrict ? `Near ${closestDistrict}, Tamil Nadu, India` : `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
    return {
      address: fallbackName,
      displayName: fallbackName,
      fullDisplayName: fallbackName,
      formatted: fallbackName,
      details: {
        city: closestDistrict || '',
        district: closestDistrict || '',
        state: 'Tamil Nadu'
      }
    };
  },

  /**
   * Generate universal directions / navigation URL
   */
  getNavigationUrl(lat, lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
};

if (typeof window !== 'undefined') {
  window.MapHelper = MapHelper;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapHelper;
}

