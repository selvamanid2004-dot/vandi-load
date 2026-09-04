/**
 * Vandi Load - Load Estimator & Assistant
 * Dynamically evaluates vehicle recommendations based on live database capacities.
 */

function estimateVehicleForLoad(itemType, countOrWeight) {
  const count = parseInt(countOrWeight, 10);
  
  if (isNaN(count) || count <= 0) {
    const mini = typeof VEHICLES_DATA !== 'undefined' ? (VEHICLES_DATA.find(v => v.id.includes('mini') || v.category === 'pickup') || VEHICLES_DATA[0]) : null;
    return {
      vehicleId: mini ? mini.id : "mini-pickup",
      vehicleName: mini ? mini.name : "Mini Pickup",
      reason: "Suitable for small everyday loads and quick city delivery."
    };
  }

  // Parse live vehicle list if available
  if (typeof VEHICLES_DATA !== 'undefined' && VEHICLES_DATA.length > 0) {
    if (itemType === "house_shifting") {
      const match = VEHICLES_DATA.find(v => v.id.includes('14') || v.category === 'medium') || VEHICLES_DATA[0];
      return {
        vehicleId: match.id,
        vehicleName: match.name,
        reason: "Spacious enough for furniture, beds, appliances, and packed cartons together."
      };
    }

    if (itemType === "machinery" || itemType === "pipes") {
      const match = VEHICLES_DATA.find(v => v.category === 'special' || v.id.includes('other') || v.id.includes('17')) || VEHICLES_DATA[0];
      return {
        vehicleId: match.id,
        vehicleName: match.name,
        reason: "Best for odd dimensions and easy crane/forklift loading."
      };
    }

    // Boxes & bundles scaling
    if (count <= 25) {
      const v = VEHICLES_DATA.find(item => item.id.includes('mini')) || VEHICLES_DATA[0];
      return { vehicleId: v.id, vehicleName: v.name, reason: `Perfect fit for ${count} ${itemType}. Compact, quick, and economical.` };
    } else if (count <= 55) {
      const v = VEHICLES_DATA.find(item => item.id.includes('small')) || VEHICLES_DATA[1] || VEHICLES_DATA[0];
      return { vehicleId: v.id, vehicleName: v.name, reason: `Ideal for ${count} ${itemType}. Plenty of space with reliable loading bed.` };
    } else if (count <= 90) {
      const v = VEHICLES_DATA.find(item => item.id.includes('truck') || item.category === 'pickup') || VEHICLES_DATA[2] || VEHICLES_DATA[0];
      return { vehicleId: v.id, vehicleName: v.name, reason: `Recommended for ${count} ${itemType}. Strong suspension and good cargo volume.` };
    } else if (count <= 200) {
      const v = VEHICLES_DATA.find(item => item.id.includes('14')) || VEHICLES_DATA[3] || VEHICLES_DATA[0];
      return { vehicleId: v.id, vehicleName: v.name, reason: `Best suited for ${count} ${itemType}. Full commercial capacity with covered protection.` };
    } else if (count <= 350) {
      const v = VEHICLES_DATA.find(item => item.id.includes('17')) || VEHICLES_DATA[4] || VEHICLES_DATA[0];
      return { vehicleId: v.id, vehicleName: v.name, reason: `Recommended for bulk volume of ${count} ${itemType}. Heavy cargo capability.` };
    } else {
      const v = VEHICLES_DATA.find(item => item.id.includes('20') || item.category === 'heavy') || VEHICLES_DATA[5] || VEHICLES_DATA[0];
      return { vehicleId: v.id, vehicleName: v.name, reason: `High volume transport for ${count}+ ${itemType}. Maximum space and security.` };
    }
  }

  return {
    vehicleId: "small-pickup",
    vehicleName: "Small Pickup",
    reason: "Standard versatile vehicle suitable for most general cargo."
  };
}
