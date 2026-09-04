/**
 * Vandi Load - Database Seeder
 * Populates initial admin user, categories, vehicles, gallery items, content, and settings.
 */

const bcrypt = require('bcryptjs');
const db = require('./db');

function seedDatabase() {
  console.log('Seeding Vandi Load database...');

  // 1. Seed Admin User
  const adminCheck = db.prepare('SELECT COUNT(*) as count FROM admins').get();
  if (adminCheck.count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('admin123', salt);
    
    const insertAdmin = db.prepare(`
      INSERT INTO admins (username, email, password_hash, full_name, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertAdmin.run('admin', 'admin@vandiload.com', passwordHash, 'Vandi Load Administrator', 'superadmin');
    console.log('✔ Default admin created: admin@vandiload.com / admin123');
  }

  // 2. Seed Categories
  const categoryCheck = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (categoryCheck.count === 0) {
    const initialCategories = [
      {
        id: "pickup",
        name: "Pickups & Small Trucks",
        description: "Compact & agile utility vehicles for 500 kg to 1.7 Tons. Great for small shops, quick city deliveries, and retail parcels.",
        capacity_info: "Up to 1.7 Tons / 15-80 Boxes",
        image: "assets/images/vehicles/small-pickup.jpg",
        display_order: 1,
        status: "active"
      },
      {
        id: "medium",
        name: "14 & 17 Feet Trucks",
        description: "Standard commercial trucks for 3.5 to 6.0 Tons. Ideal for factory goods, full house moves, wholesale distribution, and long-distance cargo.",
        capacity_info: "3.5 to 6.0 Tons / 100-250 Cartons",
        image: "assets/images/vehicles/14ft-truck.jpg",
        display_order: 2,
        status: "active"
      },
      {
        id: "heavy",
        name: "20 Feet & Containers",
        description: "Heavy-duty commercial freight carriers & weatherproof containers for 7.0 to 15+ Tons. Maximum volume and enclosed cargo protection.",
        capacity_info: "7.0 to 15+ Tons / 300-500+ Boxes",
        image: "assets/images/vehicles/20ft-truck.jpg",
        display_order: 3,
        status: "active"
      },
      {
        id: "special",
        name: "Special / Open Body",
        description: "Open flatbed, multi-axle trailers, and custom cargo transport for construction steel, pipes, heavy machinery, and oversized cargo.",
        capacity_info: "Custom Heavy / Industrial Loads",
        image: "assets/images/vehicles/other-vehicles.jpg",
        display_order: 4,
        status: "active"
      }
    ];

    const insertCat = db.prepare(`
      INSERT INTO categories (id, name, description, image, capacity_info, display_order, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of initialCategories) {
      insertCat.run(c.id, c.name, c.description, c.image, c.capacity_info, c.display_order, c.status);
    }
    console.log(`✔ Seeded ${initialCategories.length} categories.`);
  }

  // 3. Seed Initial 8 Vehicles
  const vehicleCheck = db.prepare('SELECT COUNT(*) as count FROM vehicles').get();
  if (vehicleCheck.count === 0) {
    const initialVehicles = [
      {
        id: "mini-pickup",
        name: "Mini Pickup",
        category: "pickup",
        capacity_kg: "500 - 750 kg",
        capacity_boxes: "Up to 25 Boxes / Bundles",
        bed_size: "4.5 to 5.5 Feet Bed",
        badge: "Popular for Small Loads",
        best_for: JSON.stringify([
          "Small shop stock & daily parcels",
          "15 to 25 carton boxes or bundles",
          "Light home items / 1-2 appliances",
          "Quick city pickups & narrow streets"
        ]),
        description: "Great for quick local transport of small loads, few boxes, bundles, or light equipment inside the city.",
        image: "assets/images/vehicles/mini-pickup.jpg",
        display_order: 1,
        status: "active"
      },
      {
        id: "small-pickup",
        name: "Small Pickup",
        category: "pickup",
        capacity_kg: "1.0 - 1.2 Tons",
        capacity_boxes: "Up to 50 Boxes / Bundles",
        bed_size: "7.0 Feet Open / Semi-Closed Bed",
        badge: "Best Value",
        best_for: JSON.stringify([
          "Medium shop goods & market delivery",
          "30 to 50 carton boxes / sacs",
          "1 BHK light house shifting",
          "Hardware, pipes & agricultural produce"
        ]),
        description: "A reliable workhorse for small businesses, retail distribution, and moderate loads.",
        image: "assets/images/vehicles/small-pickup.jpg",
        display_order: 2,
        status: "active"
      },
      {
        id: "pickup-truck",
        name: "Pickup Truck",
        category: "pickup",
        capacity_kg: "1.5 - 1.7 Tons",
        capacity_boxes: "Up to 80 Boxes / Bundles",
        bed_size: "8.5 to 9.0 Feet Bed",
        badge: "Heavy Pickup",
        best_for: JSON.stringify([
          "Commercial market goods & wholesale",
          "50 to 80 packed boxes or bundles",
          "Furniture, machines & event goods",
          "Intercity & town-to-town transit"
        ]),
        description: "Strong load capacity for heavier commercial shipments and multi-carton retail cargo.",
        image: "assets/images/vehicles/pickup-truck.jpg",
        display_order: 3,
        status: "active"
      },
      {
        id: "14-feet",
        name: "14 Feet Vehicle",
        category: "medium",
        capacity_kg: "3.5 - 4.0 Tons",
        capacity_boxes: "Up to 180 Boxes / Bundles",
        bed_size: "14 Feet Closed / Open Body",
        badge: "High Demand",
        best_for: JSON.stringify([
          "Medium factory goods & bulk cargo",
          "100 to 180 standard cartons",
          "Full 2 BHK / 3 BHK house moving",
          "Electronics, textiles & dry freight"
        ]),
        description: "The ideal standard commercial truck for wholesale distribution and larger house shifting.",
        image: "assets/images/vehicles/14ft-truck.jpg",
        display_order: 4,
        status: "active"
      },
      {
        id: "17-feet",
        name: "17 Feet Vehicle",
        category: "medium",
        capacity_kg: "5.0 - 6.0 Tons",
        capacity_boxes: "Up to 250 Boxes / Bundles",
        bed_size: "17 Feet Tarpaulin / Closed Body",
        badge: "Heavy Commercial",
        best_for: JSON.stringify([
          "Heavy industrial materials & bulk boxes",
          "Raw materials, auto components & pipes",
          "Large warehouse-to-warehouse transport",
          "Long-distance state transportation"
        ]),
        description: "Spacious heavy-duty truck built for bulk industrial transport and interstate delivery.",
        image: "assets/images/vehicles/17ft-truck.jpg",
        display_order: 5,
        status: "active"
      },
      {
        id: "20-feet",
        name: "20 Feet Vehicle",
        category: "heavy",
        capacity_kg: "7.0 - 9.0 Tons",
        capacity_boxes: "Up to 400 Boxes / Bundles",
        bed_size: "20 Feet Long Bed / Container",
        badge: "High Volume",
        best_for: JSON.stringify([
          "High volume factory consignments",
          "FMCG goods, plastics & bulk cartons",
          "Long structural equipment & machinery",
          "Direct intercity logistics"
        ]),
        description: "Extended load capacity for heavy cargo and volume-intensive commercial goods.",
        image: "assets/images/vehicles/20ft-truck.jpg",
        display_order: 6,
        status: "active"
      },
      {
        id: "container",
        name: "Container",
        category: "heavy",
        capacity_kg: "10 - 15+ Tons",
        capacity_boxes: "500+ Boxes / High Volume Freight",
        bed_size: "24ft to 32ft Closed Container",
        badge: "100% Weatherproof",
        best_for: JSON.stringify([
          "High-value goods & export consignments",
          "Weather-sensitive electronics & pharma",
          "Full truckload (FTL) long-haul shipments",
          "Protected, locked & sealed transport"
        ]),
        description: "Fully covered, lockable container transport providing maximum weather protection and security.",
        image: "assets/images/vehicles/container-truck.jpg",
        display_order: 7,
        status: "active"
      },
      {
        id: "other-vehicles",
        name: "Other Vehicles",
        category: "special",
        capacity_kg: "Custom / Heavy Duty",
        capacity_boxes: "Special Cargo / Project Loads",
        bed_size: "Open Flatbed, Multi-Axle, Trailers",
        badge: "Custom Transport",
        best_for: JSON.stringify([
          "Odd-sized machinery & heavy equipment",
          "Construction materials, steel & iron rods",
          "Custom trailers & open body needs",
          "Any load that needs a special vehicle"
        ]),
        description: "Have a unique load or unusual size? Our team finds the exact custom transport vehicle for you.",
        image: "assets/images/vehicles/other-vehicles.jpg",
        display_order: 8,
        status: "active"
      }
    ];

    const insertVehicle = db.prepare(`
      INSERT INTO vehicles (id, name, category, capacity_kg, capacity_boxes, bed_size, badge, best_for, description, image, display_order, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const v of initialVehicles) {
      insertVehicle.run(v.id, v.name, v.category, v.capacity_kg, v.capacity_boxes, v.bed_size, v.badge, v.best_for, v.description, v.image, v.display_order, v.status);
    }
    console.log(`✔ Seeded ${initialVehicles.length} initial vehicles.`);
  }

  // 4. Seed Gallery Items
  const galleryCheck = db.prepare('SELECT COUNT(*) as count FROM gallery').get();
  if (galleryCheck.count === 0) {
    const initialGallery = [
      { title: "Mini Pickup - Local City Goods Delivery", category: "pickup", image_url: "assets/images/vehicles/mini-pickup.jpg", display_order: 1 },
      { title: "Small Pickup - Loaded Carton Boxes", category: "pickup", image_url: "assets/images/vehicles/small-pickup.jpg", display_order: 2 },
      { title: "Pickup Truck - Industrial Wholesale Transport", category: "pickup", image_url: "assets/images/vehicles/pickup-truck.jpg", display_order: 3 },
      { title: "14 Feet Truck - Warehouse Loading Bay", category: "medium", image_url: "assets/images/vehicles/14ft-truck.jpg", display_order: 4 },
      { title: "17 Feet Truck - Heavy Tarpaulin Cargo", category: "medium", image_url: "assets/images/vehicles/17ft-truck.jpg", display_order: 5 },
      { title: "20 Feet Multi-Axle - Intercity Volume Carrier", category: "heavy", image_url: "assets/images/vehicles/20ft-truck.jpg", display_order: 6 },
      { title: "Enclosed Container - Secure Weatherproof Transport", category: "heavy", image_url: "assets/images/vehicles/container-truck.jpg", display_order: 7 },
      { title: "Open Flatbed Carrier - Machinery & Heavy Goods", category: "special", image_url: "assets/images/vehicles/other-vehicles.jpg", display_order: 8 }
    ];

    const insertGallery = db.prepare(`
      INSERT INTO gallery (title, category, image_url, display_order, status)
      VALUES (?, ?, ?, ?, 'active')
    `);

    for (const g of initialGallery) {
      insertGallery.run(g.title, g.category, g.image_url, g.display_order);
    }
    console.log(`✔ Seeded ${initialGallery.length} gallery items.`);
  }

  // 5. Seed Website Content
  const defaultContents = {
    hero: {
      badge: "Reliable Transport for Any Load",
      heading: "Need a Vehicle for Your Load?",
      lead: "Tell us what you want to send. We'll help you find the right vehicle.",
      btn_primary: "Get a Vehicle",
      btn_secondary: "Join as Driver"
    },
    about: {
      title: "Making Load Transport Simple for Everyone",
      lead: "Many times, a shopkeeper, factory owner, or individual has goods like 50 bundles, 100 boxes, or machinery to move, but they are not sure which vehicle to call.",
      description: "Vandi Load was started to solve this exact problem. You simply tell us what you have to send. Our team finds the exact vehicle size, connects a verified driver, and manages the pickup and delivery smoothly.",
      stats_number: "5,000+",
      stats_label: "Successful Loads Delivered"
    },
    how_it_works: {
      title: "How It Works",
      subtitle: "Moving your load with Vandi Load is quick and simple. Here is how we take care of everything:",
      steps: [
        { num: 1, title: "Tell Us About Your Load", desc: "Tell us what you want to send (e.g. 50 boxes, bundles, furniture) and your pickup and delivery locations." },
        { num: 2, title: "We Find the Right Vehicle", desc: "Our team reviews your load details and selects the perfect vehicle size so you do not overpay or run out of space." },
        { num: 3, title: "We Arrange Your Driver", desc: "We assign a verified, reliable driver with a clean, road-ready vehicle for your trip." },
        { num: 4, title: "Your Load Gets Picked Up", desc: "The vehicle reaches your doorstep or warehouse on time and your goods are safely loaded." },
        { num: 5, title: "Your Load Reaches Its Destination", desc: "Your goods arrive safely at the destination on time with zero hassle." }
      ]
    },
    why_us: {
      title: "Why Choose Vandi Load?",
      subtitle: "We focus on what matters most to our customers: simple booking, honest advice, and safe transport.",
      points: [
        { title: "Right Vehicle", desc: "We help you select the exact vehicle size so you never overpay for extra empty space." },
        { title: "Verified Drivers", desc: "Experienced drivers with checked background documents and clean vehicle fitness." },
        { title: "Quick Response", desc: "Our team contacts you quickly after you send a request to confirm your trip details." },
        { title: "Easy Request", desc: "No complicated signups or apps required. Just share your load details in 30 seconds." },
        { title: "Reliable Service", desc: "Safe, on-time pickup and careful handling of your goods till they reach the receiver." }
      ]
    },
    cta: {
      title: "Need a Vehicle for Your Load?",
      description: "Tell us your pickup and delivery details. We'll contact you and arrange the right vehicle right away.",
      btn_text: "Get a Vehicle"
    },
    footer: {
      description: "Vandi Load connects people and businesses who have loads with the right vehicles and verified drivers. Simple, honest, and reliable transport.",
      copyright: "© 2026 Vandi Load. All rights reserved. Move • Trust • Deliver."
    }
  };

  const insertOrIgnoreContent = db.prepare(`
    INSERT INTO website_content (section_key, content_json)
    VALUES (?, ?)
    ON CONFLICT(section_key) DO NOTHING
  `);

  for (const [key, val] of Object.entries(defaultContents)) {
    insertOrIgnoreContent.run(key, JSON.stringify(val));
  }

  // 6. Seed Global Settings
  const defaultSettings = {
    company_name: "Vandi Load",
    company_tagline: "MOVE • TRUST • DELIVER",
    company_logo: "assets/images/logo.png",
    phone_number: "+91 98765 43210",
    whatsapp_number: "+91 98765 43210",
    email: "support@vandiload.com",
    address: "Main Logistics Hub, Industrial Ring Road",
    working_hours: "24/7 Transport Booking",
    social_facebook: "",
    social_instagram: "",
    social_twitter: ""
  };

  const insertOrIgnoreSetting = db.prepare(`
    INSERT INTO settings (setting_key, setting_value)
    VALUES (?, ?)
    ON CONFLICT(setting_key) DO NOTHING
  `);

  for (const [k, v] of Object.entries(defaultSettings)) {
    insertOrIgnoreSetting.run(k, v);
  }

  // 7. Seed Initial Approved Drivers
  const driverCheck = db.prepare('SELECT COUNT(*) as count FROM driver_applications').get();
  if (driverCheck.count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const defaultDriverPass = bcrypt.hashSync('driver123', salt);

    const insertDriver = db.prepare(`
      INSERT INTO driver_applications (
        full_name, phone, location, vehicle_type, vehicle_number, experience, message, status, password_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertDriver.run('Rajesh Kumar', '9876500001', 'Chennai', '14-feet', 'TN 09 AB 1234', 6, 'Experienced commercial driver with clean record', 'approved', defaultDriverPass);
    insertDriver.run('Murugan S', '9876500002', 'Coimbatore', 'small-pickup', 'TN 38 CD 5678', 4, 'Local city delivery and market specialist', 'approved', defaultDriverPass);
    insertDriver.run('Suresh V', '9876500003', 'Madurai', '20-feet', 'TN 58 EF 9012', 8, 'Heavy container intercity driver', 'pending', defaultDriverPass);
    console.log('✔ Seeded initial drivers (Login: 9876500001 / driver123)');
  }

  // 8. Seed Sample Enquiries if none
  const enquiryCheck = db.prepare('SELECT COUNT(*) as count FROM contact_enquiries').get();
  if (enquiryCheck.count === 0) {
    const insertEnquiry = db.prepare(`
      INSERT INTO contact_enquiries (
        request_code, name, phone, subject, message, pickup_city, drop_city, goods_category, quantity, vehicle_preferred, status, assigned_driver_id, assigned_driver_name, assigned_driver_phone, assignment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertEnquiry.run('VL-824101', 'Anand Textiles', '9840112233', 'Textile Bundles Transport', '50 bundles of cotton fabrics for wholesale distribution', 'Chennai (Guindy)', 'Coimbatore (RS Puram)', 'Textiles / Fabric Bundles', '50 Bundles (~1.2 Tons)', '14 Feet Vehicle', 'contacted', 1, 'Rajesh Kumar', '9876500001', 'Assigned');
    insertEnquiry.run('VL-931204', 'Karthik Electricals', '9789223344', 'Appliance Boxes', '120 carton boxes of light fittings', 'Chennai (Ambattur)', 'Madurai', 'Carton Boxes / Electrical Goods', '120 Cartons', '14 Feet Vehicle', 'contacted', 1, 'Rajesh Kumar', '9876500001', 'In Progress');
    insertEnquiry.run('VL-552190', 'Modern Kitchenwares', '9884556677', 'Kitchenware Supplies', '30 medium boxes', 'Coimbatore', 'Salem', 'Kitchen Products', '30 Boxes', 'Small Pickup', 'contacted', 2, 'Murugan S', '9876500002', 'Assigned');
    console.log('✔ Seeded initial assigned orders');
  }

  console.log('Database seeding complete!');
}

module.exports = seedDatabase;

if (require.main === module) {
  seedDatabase();
}
