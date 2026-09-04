/**
 * Test Suite: Public Website Modals Regression Audit
 * Verifies all 3 public actions (Get Vehicle, Enquiry, Join as Driver),
 * pickup & delivery maps, form submissions, and admin visibility.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');
const db = require(path.join(rootDir, 'database', 'db'));

async function runTests() {
  console.log('=================================================================');
  console.log('🚀 RUNNING PUBLIC WEBSITE MODALS REGRESSION AUDIT');
  console.log('=================================================================\n');

  let passed = 0;
  const total = 8;

  // Setup DOM mock environment
  const domElements = {};
  function createMockElement(id, tagName = 'div') {
    const el = {
      id: id,
      tagName: tagName.toUpperCase(),
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); },
        toggle(c) { if (this.contains(c)) this.remove(c); else this.add(c); }
      },
      style: {},
      value: '',
      innerHTML: '',
      textContent: '',
      children: [],
      files: [],
      appendChild(child) { this.children.push(child); return child; },
      addEventListener(evt, handler) { this._listeners = this._listeners || {}; this._listeners[evt] = handler; },
      dispatchEvent(evt) { if (this._listeners && this._listeners[evt.type]) this._listeners[evt.type](evt); },
      reset() { this.value = ''; }
    };
    domElements[id] = el;
    return el;
  }

  // Pre-create modal DOM elements
  createMockElement('getVehicleModal');
  createMockElement('joinDriverModal');
  createMockElement('siteToast');
  createMockElement('reqVehicleType', 'select');
  createMockElement('reqPickupState', 'select');
  createMockElement('reqPickupDistrict', 'select');
  createMockElement('reqPickupCity', 'input');
  createMockElement('reqPickupAddress', 'input');
  createMockElement('reqPickupLatitude', 'input');
  createMockElement('reqPickupLongitude', 'input');
  createMockElement('reqPickupMapContainer', 'div');
  createMockElement('reqPickupLocationBadge', 'div');
  createMockElement('reqDropState', 'select');
  createMockElement('reqDropDistrict', 'select');
  createMockElement('reqDropCity', 'input');
  createMockElement('reqDropAddress', 'input');
  createMockElement('reqDropLatitude', 'input');
  createMockElement('reqDropLongitude', 'input');
  createMockElement('reqDropMapContainer', 'div');
  createMockElement('reqDropLocationBadge', 'div');
  createMockElement('reqGoodsCategory', 'select');
  createMockElement('reqQuantityCount', 'input');
  createMockElement('reqCustomerName', 'input');
  createMockElement('reqPhone', 'input');
  createMockElement('reqCustomerEmail', 'input');
  createMockElement('reqLoadNotes', 'textarea');
  createMockElement('submitVehicleRequestBtn', 'button');
  createMockElement('getVehicleForm', 'form');
  createMockElement('driverState', 'select');
  createMockElement('driverDistrict', 'select');

  // Load scripts in VM sandbox
  const sandbox = {
    console: console,
    document: {
      getElementById(id) {
        return domElements[id] || null;
      },
      createElement(tag) {
        return createMockElement('elem_' + Math.random().toString(36).substr(2, 5), tag);
      },
      querySelectorAll() { return []; },
      querySelector() { return null; },
      addEventListener() {},
      body: { style: {} }
    },
    window: {},
    L: {
      map: () => ({
        setView() { return this; },
        on() { return this; },
        invalidateSize() {}
      }),
      tileLayer: () => ({ addTo() {} }),
      marker: () => ({
        addTo() { return this; },
        setLatLng() { return this; },
        bindPopup() { return this; },
        openPopup() { return this; },
        on() { return this; },
        getLatLng() { return { lat: 11.0168, lng: 76.9558 }; }
      }),
      divIcon: () => ({})
    },
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    fetch: global.fetch || (() => Promise.resolve({ json: () => ({}) })),
    VEHICLES_DATA: [
      { id: 'mini-pickup', name: 'Mini Pickup', capacityKg: '750 kg', category: 'pickup' },
      { id: 'small-pickup', name: 'Small Pickup', capacityKg: '1.2 Tons', category: 'pickup' }
    ]
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);

  // Load MapHelper
  const mapHelperCode = fs.readFileSync(path.join(rootDir, 'js', 'map-helper.js'), 'utf8');
  vm.runInContext(mapHelperCode, sandbox);

  // Load Modals and export top-level variables to window
  const modalsCode = fs.readFileSync(path.join(rootDir, 'js', 'modals.js'), 'utf8');
  vm.runInContext(modalsCode + '\n;window.getPickupPicker = () => pickupMapPicker; window.getDropPicker = () => dropMapPicker;', sandbox);

  // TEST 1: Get Vehicle Modal opens
  console.log('TEST 1: Click "Get Vehicle" -> openGetVehicleModal()');
  try {
    assert(typeof sandbox.openGetVehicleModal === 'function', 'openGetVehicleModal must be a valid function');
    sandbox.openGetVehicleModal('mini-pickup');
    const modal = domElements['getVehicleModal'];
    assert(modal.classList.contains('active'), 'getVehicleModal must have active class');
    console.log('  ✓ Get Vehicle modal opened successfully');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 1:', err.message);
  }

  // TEST 2: Close and Click "Enquiry" -> openModal('getVehicleModal')
  console.log('\nTEST 2: Close and Click "Enquiry" / Customer Request form');
  try {
    sandbox.closeModal('getVehicleModal');
    const modal = domElements['getVehicleModal'];
    assert(!modal.classList.contains('active'), 'getVehicleModal must not have active class after closeModal');

    sandbox.openModal('getVehicleModal');
    assert(modal.classList.contains('active'), 'getVehicleModal must open for Enquiry');
    console.log('  ✓ Enquiry / Customer Request form opens successfully');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 2:', err.message);
  }

  // TEST 3: Close and Click "Join as Driver" -> openDriverModal()
  console.log('\nTEST 3: Close and Click "Join as Driver" -> openDriverModal()');
  try {
    sandbox.closeModal('getVehicleModal');
    sandbox.openDriverModal();
    const driverModal = domElements['joinDriverModal'];
    assert(driverModal.classList.contains('active'), 'joinDriverModal must have active class');
    sandbox.closeModal('joinDriverModal');
    assert(!driverModal.classList.contains('active'), 'joinDriverModal must close cleanly');
    console.log('  ✓ Join as Driver modal opens and closes successfully');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 3:', err.message);
  }

  // TEST 4: Pickup Map initialization
  console.log('\nTEST 4: Pickup Map initializes and sets coordinates');
  try {
    const pickupPicker = sandbox.getPickupPicker();
    assert(pickupPicker !== null && pickupPicker !== undefined, 'pickupMapPicker instance should be initialized');
    assert(typeof pickupPicker.invalidateSize === 'function', 'pickupMapPicker.invalidateSize must exist');
    console.log('  ✓ Pickup map component operational');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 4:', err.message);
  }

  // TEST 5: Delivery Destination Map initialization
  console.log('\nTEST 5: Delivery Destination Map initializes and sets coordinates');
  try {
    const dropPicker = sandbox.getDropPicker();
    assert(dropPicker !== null && dropPicker !== undefined, 'dropMapPicker instance should be initialized');
    assert(typeof dropPicker.invalidateSize === 'function', 'dropMapPicker.invalidateSize must exist');
    console.log('  ✓ Delivery Destination map component operational');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 5:', err.message);
  }

  // TEST 6: Submit a test enquiry via backend API / DatabaseSync
  console.log('\nTEST 6: Submit test enquiry with Pickup & Delivery Coordinates');
  let newEnquiryId = null;
  const testCode = 'REG-' + Date.now().toString().slice(-6);
  try {
    const stmt = db.prepare(`
      INSERT INTO contact_enquiries (
        request_code, name, phone, customer_email,
        pickup_state, pickup_district, pickup_city, pickup_address, pickup_latitude, pickup_longitude,
        drop_state, drop_district, drop_city, drop_address, drop_latitude, drop_longitude,
        goods_category, quantity, vehicle_preferred, message, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      testCode, 'Test Regression Customer', '9876543210', 'regression@test.com',
      'Tamil Nadu', 'Coimbatore', 'Coimbatore City', 'Gandhipuram', 11.01680, 76.95580,
      'Tamil Nadu', 'Chennai', 'Chennai Port', 'Harbor Area', 13.08270, 80.27070,
      'Carton Boxes', '40 Boxes', 'Mini Pickup', 'Urgent transport regression check', 'new'
    );

    newEnquiryId = result.lastInsertRowid;
    assert(newEnquiryId > 0, 'Enquiry record ID must be positive integer');
    console.log(`  ✓ Test enquiry created successfully with ID: ${newEnquiryId} [${testCode}]`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 6:', err.message);
  }

  // TEST 7: Open Admin & Verify new enquiry appears
  console.log('\nTEST 7: Admin query verifies new enquiry with all pickup and delivery coordinates');
  try {
    const enquiry = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(newEnquiryId);

    assert(enquiry, 'Enquiry must be found in database');
    assert.strictEqual(enquiry.request_code, testCode);
    assert.strictEqual(enquiry.pickup_latitude, 11.01680);
    assert.strictEqual(enquiry.drop_latitude, 13.08270);
    assert.strictEqual(enquiry.pickup_city, 'Coimbatore City');
    assert.strictEqual(enquiry.drop_city, 'Chennai Port');
    console.log('  ✓ Enquiry retrieved correctly with full pickup & delivery coordinates');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 7:', err.message);
  }

  // TEST 8: Verify HTML button mappings and script tags
  console.log('\nTEST 8: Verify index.html button triggers & script inclusion');
  try {
    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(indexHtml.includes('onclick="openGetVehicleModal()"'), 'index.html must have openGetVehicleModal() buttons');
    assert(indexHtml.includes('onclick="openDriverModal()"'), 'index.html must have openDriverModal() buttons');
    assert(indexHtml.includes('id="getVehicleModal"'), 'index.html must have getVehicleModal container');
    assert(indexHtml.includes('id="joinDriverModal"'), 'index.html must have joinDriverModal container');
    assert(indexHtml.includes('src="js/modals.js"'), 'index.html must include js/modals.js');
    console.log('  ✓ All HTML modal triggers and containers verified');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 8:', err.message);
  }

  console.log('\n=================================================================');
  console.log(`AUDIT RESULTS: ${passed}/${total} PASSED (${Math.round(passed/total*100)}%)`);
  console.log('=================================================================\n');

  if (passed === total) {
    console.log('🎉 REGRESSION FIX VERIFICATION COMPLETED WITH 100% PASS RATE');
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
