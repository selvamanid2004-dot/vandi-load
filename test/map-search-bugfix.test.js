/**
 * Test Suite: Customer Map Location Search Bug Fix
 * Tests all 10 scenarios specified in the requirements.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// We simulate the environment for MapHelper and backend workflow testing
const rootDir = path.resolve(__dirname, '..');

async function runTests() {
  console.log('=================================================================');
  console.log('🚀 RUNNING CUSTOMER MAP LOCATION SEARCH BUG FIX AUDIT');
  console.log('=================================================================\n');

  // Load MapHelper implementation
  const mapHelperContent = fs.readFileSync(path.join(rootDir, 'js', 'map-helper.js'), 'utf8');

  // Create isolated sandbox
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
  assert(MapHelper, 'MapHelper must be defined');

  let passed = 0;
  let total = 10;

  // TEST 1: Search "Chennai Central Railway Station"
  console.log('TEST 1: Search "Chennai Central Railway Station"');
  try {
    const res = await MapHelper.searchAddress('Chennai Central Railway Station');
    assert(res && res.length > 0, 'Must return at least 1 result for Chennai Central Railway Station');
    assert(res[0].lat && res[0].lng, 'Result must contain lat & lng');
    console.log(`  ✓ Found: ${res[0].name} at (${res[0].lat}, ${res[0].lng})`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 1:', err.message);
  }

  // TEST 2: Search "Guindy, Chennai"
  console.log('\nTEST 2: Search "Guindy, Chennai"');
  try {
    const res = await MapHelper.searchAddress('Guindy, Chennai');
    assert(res && res.length > 0, 'Must return results for Guindy, Chennai');
    assert(Math.abs(res[0].lat - 13.0) < 0.2, 'Lat should be close to Chennai/Guindy (~13.0)');
    console.log(`  ✓ Found: ${res[0].name} at (${res[0].lat}, ${res[0].lng})`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 2:', err.message);
  }

  // TEST 3: Search "600001" (Pincode)
  console.log('\nTEST 3: Search 6-digit Pincode "600001"');
  try {
    const res = await MapHelper.searchAddress('600001');
    assert(res && res.length > 0, 'Must return results for 600001');
    console.log(`  ✓ Found: ${res[0].name} at (${res[0].lat}, ${res[0].lng})`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 3:', err.message);
  }

  // TEST 4: Supported Google Maps URL with coordinates
  console.log('\nTEST 4: Google Maps URL parsing');
  try {
    const testUrl1 = 'https://www.google.com/maps/@13.0826802,80.2707184,17z';
    const testUrl2 = 'https://maps.google.com/?q=11.0168,76.9558';
    
    const res1 = await MapHelper.searchAddress(testUrl1);
    assert(res1 && res1.length > 0, 'Must parse @lat,lng format');
    assert(Math.abs(res1[0].lat - 13.08268) < 0.001, 'Parsed lat matches');

    const res2 = await MapHelper.searchAddress(testUrl2);
    assert(res2 && res2.length > 0, 'Must parse ?q=lat,lng format');
    assert(Math.abs(res2[0].lat - 11.0168) < 0.001, 'Parsed lat matches');

    console.log(`  ✓ Successfully resolved Google Maps URLs to (${res1[0].lat}, ${res1[0].lng}) and (${res2[0].lat}, ${res2[0].lng})`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 4:', err.message);
  }

  // TEST 5: Enter "13.0827, 80.2707"
  console.log('\nTEST 5: Coordinates Input "13.0827, 80.2707"');
  try {
    const res = await MapHelper.searchAddress('13.0827, 80.2707');
    assert(res && res.length > 0, 'Must parse lat/lng coordinate strings directly');
    assert.strictEqual(res[0].lat, 13.0827);
    assert.strictEqual(res[0].lng, 80.2707);
    console.log(`  ✓ Coordinates matched exactly: ${res[0].name} (${res[0].lat}, ${res[0].lng})`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 5:', err.message);
  }

  // TEST 6: Reverse Geocoding on click/drag
  console.log('\nTEST 6: Reverse Geocoding (coordinates -> address)');
  try {
    const rev = await MapHelper.reverseGeocode(13.0827, 80.2707);
    assert(rev && (rev.address || rev.formatted), 'Must return reverse geocoded address object');
    console.log(`  ✓ Reverse Geocoded (13.0827, 80.2707) -> "${rev.address || rev.formatted}"`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 6:', err.message);
  }

  // TEST 7: Submit enquiry with coordinates and verify database persistence
  console.log('\nTEST 7: Submit Enquiry with Lat/Lng & Verify DB Storage');
  let createdEnquiryId = null;
  try {
    const testPayload = {
      name: 'Map Search Test Customer',
      phone: '9876543210',
      email: 'mapcustomer@test.com',
      pickupState: 'Tamil Nadu',
      pickupDistrict: 'Chennai',
      pickupCity: 'Guindy',
      pickupAddress: 'Guindy Industrial Estate, Chennai',
      pickupLatitude: 13.0067,
      pickupLongitude: 80.2024,
      dropState: 'Tamil Nadu',
      dropDistrict: 'Coimbatore',
      dropCity: 'Gandhipuram',
      dropAddress: 'Gandhipuram Bus Stand',
      goodsCategory: 'Industrial Goods',
      quantity: '2 Tons',
      vehiclePreferred: 'Tata 407 (2.5 Ton)'
    };

    const serverPort = 3000;
    const response = await fetch(`http://localhost:${serverPort}/api/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });
    const data = await response.json();
    assert(data && data.success, 'Enquiry submission must succeed');
    createdEnquiryId = data.id || data.enquiry?.id;
    assert(createdEnquiryId, 'Enquiry must return an id');
    console.log(`  ✓ Enquiry created successfully with ID: ${createdEnquiryId}`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 7:', err.message);
  }

  // TEST 8: Admin opens enquiry and retrieves saved coordinates
  console.log('\nTEST 8: Admin views enquiry and retrieves pickup latitude/longitude');
  let adminToken = null;
  try {
    const adminLoginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: process.env.ADMIN_DEFAULT_PASSWORD || 'admin123' })
    });
    const adminAuth = await adminLoginRes.json();
    assert(adminAuth && adminAuth.token, 'Admin login must succeed');
    adminToken = adminAuth.token;

    const enquiryRes = await fetch(`http://localhost:3000/api/enquiries/admin/${createdEnquiryId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const enquiryData = await enquiryRes.json();
    const item = enquiryData.data || enquiryData;
    assert.strictEqual(Number(item.pickup_latitude), 13.0067, 'pickup_latitude must match');
    assert.strictEqual(Number(item.pickup_longitude), 80.2024, 'pickup_longitude must match');
    assert.strictEqual(item.pickup_address, 'Guindy Industrial Estate, Chennai');
    console.log(`  ✓ Admin API confirmed coordinates: (${item.pickup_latitude}, ${item.pickup_longitude}) for ${item.pickup_address}`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 8:', err.message);
  }

  // TEST 9: Assign driver and verify Driver Portal shows pickup location & coordinates
  console.log('\nTEST 9: Driver Portal receives assigned enquiry with coordinates');
  try {
    const db = require(path.join(rootDir, 'database', 'db'));
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

    // Admin assigns driver
    const assignRes = await fetch(`http://localhost:3000/api/enquiries/admin/${createdEnquiryId}/assign`, {
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

    // Driver fetches assigned orders
    const driverOrdersRes = await fetch('http://localhost:3000/api/driver/orders', {
      headers: { 'Authorization': `Bearer ${driverAuth.token}` }
    });
    const driverOrdersData = await driverOrdersRes.json();
    const orders = driverOrdersData.data || driverOrdersData;
    const myOrder = orders.find(o => o.id === createdEnquiryId);
    assert(myOrder, 'Driver portal fetched assigned order');
    assert.strictEqual(Number(myOrder.pickup_latitude), 13.0067);
    assert.strictEqual(Number(myOrder.pickup_longitude), 80.2024);
    assert.strictEqual(myOrder.pickup_address, 'Guindy Industrial Estate, Chennai');
    console.log(`  ✓ Driver Portal received order with pickup location: ${myOrder.pickup_address} (${myOrder.pickup_latitude}, ${myOrder.pickup_longitude})`);
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 9:', err.message);
  }

  // TEST 10: Try invalid random address
  console.log('\nTEST 10: Search invalid random string');
  try {
    const res = await MapHelper.searchAddress('xyzabcdefg_nonexistent_location_999999');
    assert(Array.isArray(res) && res.length === 0, 'Invalid search should return empty array [] (triggering friendly message)');
    console.log('  ✓ Correctly returned 0 results, allowing frontend to display friendly "Location not found" message');
    passed++;
  } catch (err) {
    console.error('  ✗ Failed TEST 10:', err.message);
  }

  console.log('\n=================================================================');
  console.log(`🏁 AUDIT RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed/total)*100)}%)`);
  console.log('=================================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
