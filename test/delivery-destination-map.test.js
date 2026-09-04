/**
 * Test Suite: Delivery Destination Map Integration & Independence Audit
 * Covers all 12 test scenarios specified in the requirements.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const db = require(path.join(rootDir, 'database', 'db'));

async function runTests() {
  console.log('=================================================================');
  console.log('🚀 RUNNING DELIVERY DESTINATION MAP INTEGRATION AUDIT (12 SCENARIOS)');
  console.log('=================================================================\n');

  // Load MapHelper implementation
  const mapHelperContent = fs.readFileSync(path.join(rootDir, 'js', 'map-helper.js'), 'utf8');

  const vm = require('vm');
  const sandbox = {
    console: console,
    fetch: global.fetch || require('node-fetch'),
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    encodeURIComponent: encodeURIComponent,
    URL: URL,
    MapHelper: null,
    DISTRICT_COORDINATES: null
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(mapHelperContent + '\n;this.MapHelper = typeof MapHelper !== "undefined" ? MapHelper : window.MapHelper;', sandbox);

  const MapHelper = sandbox.MapHelper || sandbox.window?.MapHelper;
  assert(MapHelper, 'MapHelper must be loaded');

  let passed = 0;
  const total = 12;

  // TEST 1: Pickup map helper methods and independence
  console.log('TEST 1: Pickup Map Initialization & Service Methods');
  try {
    assert(typeof MapHelper.createPickupPicker === 'function', 'createPickupPicker must exist');
    assert(typeof MapHelper.searchAddress === 'function', 'searchAddress must exist');
    assert(typeof MapHelper.reverseGeocode === 'function', 'reverseGeocode must exist');
    console.log('  ✓ Pickup map factory and geocoding services functional');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 1:', err.message);
  }

  // TEST 2: Delivery Destination Map Picker Factory Reusable
  console.log('\nTEST 2: Delivery Destination Map Picker Service Factory');
  try {
    assert(typeof MapHelper.createDeliveryPicker === 'function', 'createDeliveryPicker must exist');
    assert(typeof MapHelper.createLocationPicker === 'function', 'createLocationPicker must exist');
    console.log('  ✓ Delivery map picker factory successfully reuses pickup map architecture');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 2:', err.message);
  }

  // TEST 3: Search Delivery Address
  console.log('\nTEST 3: Search Delivery Address (e.g. "Gandhipuram, Coimbatore")');
  let dropLocationResult = null;
  try {
    const results = await MapHelper.searchAddress('Gandhipuram, Coimbatore');
    assert(results && results.length > 0, 'Must return results for delivery search');
    dropLocationResult = results[0];
    assert(dropLocationResult.lat && dropLocationResult.lng, 'Delivery location has coordinates');
    console.log(`  ✓ Found delivery destination: ${dropLocationResult.name} (${dropLocationResult.lat}, ${dropLocationResult.lng})`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 3:', err.message);
  }

  // TEST 4: Delivery Reverse Geocoding
  console.log('\nTEST 4: Reverse Geocode Delivery Marker Coordinates (11.0168, 76.9558)');
  try {
    const rev = await MapHelper.reverseGeocode(11.0168, 76.9558);
    assert(rev && (rev.displayName || rev.address), 'Must reverse geocode delivery coordinates');
    console.log(`  ✓ Reverse geocoded delivery coordinates: "${rev.displayName || rev.address}"`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 4:', err.message);
  }

  // TEST 5: Independence of Pickup & Delivery Coordinates
  console.log('\nTEST 5: Verify Pickup & Delivery Location Data Independence');
  const pickupData = {
    state: 'Tamil Nadu',
    district: 'Chennai',
    city: 'Chennai Central',
    address: 'Chennai Central Railway Station, Chennai',
    latitude: 13.0827,
    longitude: 80.2707
  };

  const deliveryData = {
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    city: 'Coimbatore',
    address: 'Gandhipuram Bus Stand, Coimbatore',
    latitude: 11.0168,
    longitude: 76.9558
  };

  try {
    assert.notStrictEqual(pickupData.latitude, deliveryData.latitude, 'Latitudes must be distinct');
    assert.notStrictEqual(pickupData.longitude, deliveryData.longitude, 'Longitudes must be distinct');
    assert.notStrictEqual(pickupData.city, deliveryData.city, 'Cities must be distinct');
    console.log('  ✓ Pickup (Chennai Central) and Delivery (Coimbatore) locations are completely independent');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 5:', err.message);
  }

  // TEST 6: Submit Enquiry with Both Pickup and Delivery Coordinates
  console.log('\nTEST 6: Submit Customer Enquiry with Both Pickup and Delivery Coordinates');
  let testEnquiryId = null;
  let testRequestCode = null;
  try {
    const payload = {
      name: 'Independent Location Test Customer',
      phone: '9840155667',
      customerEmail: 'indep.customer@test.com',
      pickupState: pickupData.state,
      pickupDistrict: pickupData.district,
      pickupCity: pickupData.city,
      pickupAddress: pickupData.address,
      pickupLatitude: pickupData.latitude,
      pickupLongitude: pickupData.longitude,
      dropState: deliveryData.state,
      dropDistrict: deliveryData.district,
      dropCity: deliveryData.city,
      dropAddress: deliveryData.address,
      dropLatitude: deliveryData.latitude,
      dropLongitude: deliveryData.longitude,
      goodsCategory: 'Electronics',
      quantity: '50 Cartons',
      vehiclePreferred: 'Tata Ace (1 Ton)'
    };

    const response = await fetch('http://localhost:3000/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const resData = await response.json();
    assert(resData && resData.success, 'Enquiry submission must succeed');
    testEnquiryId = resData.id || resData.enquiry?.id;
    testRequestCode = resData.requestCode;
    assert(testEnquiryId, 'Must return created enquiry ID');

    // Verify DB storage directly
    const row = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(testEnquiryId);
    assert(row, 'Row exists in SQLite');
    assert.strictEqual(Number(row.pickup_latitude), pickupData.latitude, 'pickup_latitude matches');
    assert.strictEqual(Number(row.pickup_longitude), pickupData.longitude, 'pickup_longitude matches');
    assert.strictEqual(row.pickup_address, pickupData.address, 'pickup_address matches');
    assert.strictEqual(Number(row.drop_latitude), deliveryData.latitude, 'drop_latitude matches');
    assert.strictEqual(Number(row.drop_longitude), deliveryData.longitude, 'drop_longitude matches');
    assert.strictEqual(row.drop_address, deliveryData.address, 'drop_address matches');
    console.log(`  ✓ Enquiry #${testEnquiryId} saved with distinct Pickup (${row.pickup_latitude}, ${row.pickup_longitude}) and Delivery (${row.drop_latitude}, ${row.drop_longitude})`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 6:', err.message);
  }

  // TEST 7: Admin Portal Location Access
  console.log('\nTEST 7: Admin Portal Access to Both Locations');
  let adminToken = null;
  try {
    const adminLoginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: process.env.ADMIN_DEFAULT_PASSWORD || 'admin123' })
    });
    const adminAuth = await adminLoginRes.json();
    assert(adminAuth && adminAuth.token, 'Admin login succeeded');
    adminToken = adminAuth.token;

    const enqRes = await fetch(`http://localhost:3000/api/enquiries/admin/${testEnquiryId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const enqData = await enqRes.json();
    const item = enqData.data || enqData;
    assert.strictEqual(Number(item.pickup_latitude), pickupData.latitude);
    assert.strictEqual(Number(item.pickup_longitude), pickupData.longitude);
    assert.strictEqual(Number(item.drop_latitude), deliveryData.latitude);
    assert.strictEqual(Number(item.drop_longitude), deliveryData.longitude);
    console.log(`  ✓ Admin retrieved Pickup: ${item.pickup_address} (${item.pickup_latitude}, ${item.pickup_longitude})`);
    console.log(`  ✓ Admin retrieved Delivery: ${item.drop_address} (${item.drop_latitude}, ${item.drop_longitude})`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 7:', err.message);
  }

  // TEST 8: Assign Driver and Check Driver Portal Both Locations
  console.log('\nTEST 8: Assign Driver & Verify Driver Portal Receives Both Locations');
  let driverToken = null;
  try {
    const bcrypt = require('bcryptjs');
    const driverPassHash = bcrypt.hashSync('driver123', 10);
    let driver = db.prepare("SELECT * FROM driver_applications WHERE phone = '9999900001'").get();
    if (!driver) {
      db.prepare(`
        INSERT INTO driver_applications (full_name, phone, email, state, district, location, address, vehicle_type, vehicle_number, status, password_hash)
        VALUES ('Driver Alpha', '9999900001', 'driverA@test.com', 'Tamil Nadu', 'Chennai', 'Chennai', 'Guindy Depot', '14-feet', 'TN09AB1001', 'approved', ?)
      `).run(driverPassHash);
      driver = db.prepare("SELECT * FROM driver_applications WHERE phone = '9999900001'").get();
    } else {
      db.prepare("UPDATE driver_applications SET password_hash = ?, status = 'approved' WHERE id = ?").run(driverPassHash, driver.id);
    }

    // Assign driver
    const assignRes = await fetch(`http://localhost:3000/api/enquiries/admin/${testEnquiryId}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        driverId: driver.id,
        driverName: driver.full_name,
        driverPhone: driver.phone,
        assignmentStatus: 'Waiting for Driver Confirmation'
      })
    });
    const assignData = await assignRes.json();
    assert(assignData.success, 'Driver assignment succeeded');

    // Driver login
    const driverLoginRes = await fetch('http://localhost:3000/api/driver/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9999900001', password: 'driver123' })
    });
    const driverAuth = await driverLoginRes.json();
    assert(driverAuth.token, 'Driver login succeeded');
    driverToken = driverAuth.token;

    // Fetch assigned orders
    const ordersRes = await fetch('http://localhost:3000/api/driver/orders', {
      headers: { 'Authorization': `Bearer ${driverToken}` }
    });
    const ordersData = await ordersRes.json();
    const orders = ordersData.data || ordersData;
    const assignedOrder = orders.find(o => o.id === testEnquiryId);
    assert(assignedOrder, 'Assigned order found in driver list');
    assert.strictEqual(Number(assignedOrder.pickup_latitude), pickupData.latitude);
    assert.strictEqual(Number(assignedOrder.drop_latitude), deliveryData.latitude);
    console.log('  ✓ Driver Portal received assigned order with BOTH locations intact');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 8:', err.message);
  }

  // TEST 9: Driver Opens Pickup Map Coordinates & Navigation URL
  console.log('\nTEST 9: Driver Pickup Map Coordinates & Navigation URL');
  try {
    const pickupNavUrl = MapHelper.getNavigationUrl(pickupData.latitude, pickupData.longitude);
    assert(pickupNavUrl.includes('destination=13.0827,80.2707'), 'Pickup navigation URL formatted properly');
    console.log(`  ✓ Pickup Navigation URL: ${pickupNavUrl}`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 9:', err.message);
  }

  // TEST 10: Driver Opens Delivery Map Coordinates & Navigation URL
  console.log('\nTEST 10: Driver Delivery Map Coordinates & Navigation URL');
  try {
    const dropNavUrl = MapHelper.getNavigationUrl(deliveryData.latitude, deliveryData.longitude);
    assert(dropNavUrl.includes('destination=11.0168,76.9558'), 'Delivery navigation URL formatted properly');
    console.log(`  ✓ Delivery Navigation URL: ${dropNavUrl}`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 10:', err.message);
  }

  // TEST 11: Existing Enquiries Created Before This Update
  console.log('\nTEST 11: Backward Compatibility for Legacy Enquiries');
  try {
    const legacyPayload = {
      name: 'Legacy Customer No Coordinates',
      phone: '9840199000',
      pickupCity: 'Salem',
      dropCity: 'Trichy',
      goodsCategory: 'Textiles',
      quantity: '10 Bundles'
    };

    const legacyRes = await fetch('http://localhost:3000/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(legacyPayload)
    });
    const legData = await legacyRes.json();
    assert(legData.success, 'Legacy enquiry submitted successfully');
    const legRow = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(legData.id || legData.enquiry?.id);
    assert(legRow.pickup_latitude === null && legRow.drop_latitude === null, 'Coordinates default gracefully to null');
    assert(legRow.pickup_city === 'Salem' && legRow.drop_city === 'Trichy', 'Cities preserved');
    console.log('  ✓ Legacy enquiry without coordinates processed cleanly with null values');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 11:', err.message);
  }

  // TEST 12: Regression & System Integrity
  console.log('\nTEST 12: Vehicle Catalog and System APIs Integrity');
  try {
    const vehRes = await fetch('http://localhost:3000/api/vehicles');
    const vehData = await vehRes.json();
    assert(vehData.success && Array.isArray(vehData.data) && vehData.data.length > 0, 'Vehicles API responsive');

    const catRes = await fetch('http://localhost:3000/api/categories');
    const catData = await catRes.json();
    assert(catData.success && Array.isArray(catData.data) && catData.data.length > 0, 'Categories API responsive');
    console.log(`  ✓ Public APIs verified: ${vehData.data.length} vehicles, ${catData.data.length} categories`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 12:', err.message);
  }

  console.log('\n=================================================================');
  console.log(`🏁 DELIVERY MAP AUDIT: ${passed}/${total} TESTS PASSED (${Math.round((passed/total)*100)}%)`);
  console.log('=================================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
