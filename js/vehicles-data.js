/**
 * Vandi Load - Vehicle Data Definition
 * Seamlessly synchronizes with the database while retaining safe fallback defaults.
 */

let VEHICLES_DATA = [
  {
    id: "mini-pickup",
    name: "Mini Pickup",
    category: "pickup",
    capacityKg: "500 - 750 kg",
    capacityBoxes: "Up to 25 Boxes / Bundles",
    bedSize: "4.5 to 5.5 Feet Bed",
    image: "assets/images/vehicles/mini-pickup.jpg",
    badge: "Popular for Small Loads",
    bestFor: [
      "Small shop stock & daily parcels",
      "15 to 25 carton boxes or bundles",
      "Light home items / 1-2 appliances",
      "Quick city pickups & narrow streets"
    ],
    description: "Great for quick local transport of small loads, few boxes, bundles, or light equipment inside the city."
  },
  {
    id: "small-pickup",
    name: "Small Pickup",
    category: "pickup",
    capacityKg: "1.0 - 1.2 Tons",
    capacityBoxes: "Up to 50 Boxes / Bundles",
    bedSize: "7.0 Feet Open / Semi-Closed Bed",
    badge: "Best Value",
    bestFor: [
      "Medium shop goods & market delivery",
      "30 to 50 carton boxes / sacs",
      "1 BHK light house shifting",
      "Hardware, pipes & agricultural produce"
    ],
    description: "A reliable workhorse for small businesses, retail distribution, and moderate loads."
  },
  {
    id: "pickup-truck",
    name: "Pickup Truck",
    category: "pickup",
    capacityKg: "1.5 - 1.7 Tons",
    capacityBoxes: "Up to 80 Boxes / Bundles",
    bedSize: "8.5 to 9.0 Feet Bed",
    badge: "Heavy Pickup",
    bestFor: [
      "Commercial market goods & wholesale",
      "50 to 80 packed boxes or bundles",
      "Furniture, machines & event goods",
      "Intercity & town-to-town transit"
    ],
    description: "Strong load capacity for heavier commercial shipments and multi-carton retail cargo."
  },
  {
    id: "14-feet",
    name: "14 Feet Vehicle",
    category: "medium",
    capacityKg: "3.5 - 4.0 Tons",
    capacityBoxes: "Up to 180 Boxes / Bundles",
    bedSize: "14 Feet Closed / Open Body",
    badge: "High Demand",
    bestFor: [
      "Medium factory goods & bulk cargo",
      "100 to 180 standard cartons",
      "Full 2 BHK / 3 BHK house moving",
      "Electronics, textiles & dry freight"
    ],
    description: "The ideal standard commercial truck for wholesale distribution and larger house shifting."
  },
  {
    id: "17-feet",
    name: "17 Feet Vehicle",
    category: "medium",
    capacityKg: "5.0 - 6.0 Tons",
    capacityBoxes: "Up to 250 Boxes / Bundles",
    bedSize: "17 Feet Tarpaulin / Closed Body",
    badge: "Heavy Commercial",
    bestFor: [
      "Heavy industrial materials & bulk boxes",
      "Raw materials, auto components & pipes",
      "Large warehouse-to-warehouse transport",
      "Long-distance state transportation"
    ],
    description: "Spacious heavy-duty truck built for bulk industrial transport and interstate delivery."
  },
  {
    id: "20-feet",
    name: "20 Feet Vehicle",
    category: "heavy",
    capacityKg: "7.0 - 9.0 Tons",
    capacityBoxes: "Up to 400 Boxes / Bundles",
    bedSize: "20 Feet Long Bed / Container",
    badge: "High Volume",
    bestFor: [
      "High volume factory consignments",
      "FMCG goods, plastics & bulk cartons",
      "Long structural equipment & machinery",
      "Direct intercity logistics"
    ],
    description: "Extended load capacity for heavy cargo and volume-intensive commercial goods."
  },
  {
    id: "container",
    name: "Container",
    category: "heavy",
    capacityKg: "10 - 15+ Tons",
    capacityBoxes: "500+ Boxes / High Volume Freight",
    bedSize: "24ft to 32ft Closed Container",
    badge: "100% Weatherproof",
    bestFor: [
      "High-value goods & export consignments",
      "Weather-sensitive electronics & pharma",
      "Full truckload (FTL) long-haul shipments",
      "Protected, locked & sealed transport"
    ],
    description: "Fully covered, lockable container transport providing maximum weather protection and security."
  },
  {
    id: "other-vehicles",
    name: "Other Vehicles",
    category: "special",
    capacityKg: "Custom / Heavy Duty",
    capacityBoxes: "Special Cargo / Project Loads",
    bedSize: "Open Flatbed, Multi-Axle, Trailers",
    badge: "Custom Transport",
    bestFor: [
      "Odd-sized machinery & heavy equipment",
      "Construction materials, steel & iron rods",
      "Custom trailers & open body needs",
      "Any load that needs a special vehicle"
    ],
    description: "Have a unique load or unusual size? Our team finds the exact custom transport vehicle for you."
  }
];

// Asynchronously load vehicles from database API
async function loadLiveVehicles() {
  if (typeof ClientAPI !== 'undefined') {
    const live = await ClientAPI.getVehicles();
    if (live && live.length > 0) {
      VEHICLES_DATA = live;
    }
  }
  return VEHICLES_DATA;
}

// Helper to find vehicle by ID
function getVehicleById(id) {
  return VEHICLES_DATA.find(v => v.id === id) || null;
}
