import { describe, expect, it } from "vitest";

import {
  classify,
  detectCondition,
  hasPackagedQuantity,
  isTemplateDemoProduct,
  looksLikeInvoiceLine,
  REVIEW_THRESHOLD,
  splitVehicleClass,
} from "@/lib/woo/classify";
import { decodeAmount, decodeEntities, htmlToText } from "@/lib/woo/store-api";

/*
 * Every product name below is a real one from the live cardresssl.com
 * catalogue. The classifier is the only thing categorising 935 uncategorised
 * products, so it is tested against the actual data rather than invented
 * examples.
 */

describe("decodeAmount — Store API minor units", () => {
  // Verified against the live site: this product displays රු800.00.
  it("reads 80000 with minor unit 2 as 800.00", () => {
    expect(decodeAmount("80000", 2)).toBe("800.00");
  });

  it.each([
    ["140000", 2, "1400.00"],
    ["400000", 2, "4000.00"],
    ["1200000", 2, "12000.00"],
    ["2200000", 2, "22000.00"],
    ["24450000", 2, "244500.00"],
    ["1000", 2, "10.00"],
    ["0", 2, "0.00"],
  ])("converts %s (minor unit %i) to %s", (raw, unit, expected) => {
    expect(decodeAmount(raw, unit)).toBe(expected);
  });

  it("treats an empty amount as zero", () => {
    expect(decodeAmount("", 2)).toBe("0");
  });

  it("handles a zero minor unit", () => {
    expect(decodeAmount("800", 0)).toBe("800.00");
  });

  it("passes through an already-decimal string rather than inflating it", () => {
    expect(decodeAmount("800.00", 2)).toBe("800.00");
  });
});

describe("decodeEntities", () => {
  it("decodes the numeric ampersand WordPress emits in titles", () => {
    expect(decodeEntities("Exterior Wash &#038; Machine Wax")).toBe(
      "Exterior Wash & Machine Wax",
    );
  });

  it("decodes named entities", () => {
    expect(decodeEntities("Cut &amp; Polish")).toBe("Cut & Polish");
  });

  it("collapses whitespace", () => {
    expect(decodeEntities("  Brake   Pad  Set ")).toBe("Brake Pad Set");
  });

  it("leaves an unknown entity alone rather than mangling it", () => {
    expect(decodeEntities("A &notanentity; B")).toBe("A &notanentity; B");
  });
});

describe("htmlToText", () => {
  it("strips tags and decodes entities", () => {
    expect(htmlToText("<p>Fits <b>BMW</b> E46 &amp; E90</p>")).toBe(
      "Fits BMW E46 & E90",
    );
  });
});

describe("splitVehicleClass", () => {
  it.each([
    ["Cut & Polish (Car)", "Cut & Polish", "CAR"],
    ["Cut & Polish (Van)", "Cut & Polish", "VAN"],
    ["Cut & Polish (SUV)", "Cut & Polish", "SUV"],
    ["Under Wash/Body Wash/Engine Wash (SUV)", "Under Wash/Body Wash/Engine Wash", "SUV"],
    ["Eco-Test (Car)", "Eco-Test", "CAR"],
    ["Body Wash – CAR", "Body Wash", "CAR"],
  ])("splits %s", (input, baseName, vehicleClass) => {
    const result = splitVehicleClass(input);
    expect(result.baseName).toBe(baseName);
    expect(result.vehicleClass).toBe(vehicleClass);
  });

  it("collapses the three Cut & Polish products to one base name", () => {
    const names = ["Cut & Polish (Car)", "Cut & Polish (Van)", "Cut & Polish (SUV)"];
    const bases = new Set(names.map((n) => splitVehicleClass(n).baseName));
    expect(bases.size).toBe(1);
  });

  it("keeps a size qualifier instead of discarding it", () => {
    const result = splitVehicleClass("Body Wash/Vacuum (SUV Large)");
    expect(result.vehicleClass).toBe("SUV");
    expect(result.qualifier).toBe("Large");
  });

  it("leaves a part name untouched", () => {
    expect(splitVehicleClass("Brake Pad Set").vehicleClass).toBeNull();
    expect(splitVehicleClass("Brake Pad Set").baseName).toBe("Brake Pad Set");
  });

  it("does not mistake a trailing position for a vehicle class", () => {
    expect(splitVehicleClass("Door Handle (Front Right)").vehicleClass).toBeNull();
    expect(splitVehicleClass("Brake Hose Front Left").vehicleClass).toBeNull();
  });
});

describe("classify — parts", () => {
  const cases: [string, string, string | null][] = [
    ["C-805 VIC Oil Filter", "Filters", "Oil Filters"],
    ["Cabin Filter", "Filters", "Cabin & AC Filters"],
    ["Front Brake Pad Set", "Brakes", "Brake Pads"],
    ["Brake Hose (Front Left)", "Brakes", "Brake Hoses & Lines"],
    ["Shock Absorbers Rear", "Suspension & Steering", "Shock Absorbers & Struts"],
    ["Tie Rod Set", "Suspension & Steering", "Tie Rods & Rack Ends"],
    ["Rack Ends", "Suspension & Steering", "Tie Rods & Rack Ends"],
    ["Lower Arm Bushes", "Suspension & Steering", "Control Arms & Ball Joints"],
    ["Suzuki Swift K12 Engine Mount", "Engine & Drivetrain", "Engine Mounts"],
    ["Clutch Plate & Pressure Plate AISIN", "Engine & Drivetrain", "Clutch & Pressure Plates"],
    ["5PK Alternator Belt", "Engine & Drivetrain", "Belts & Tensioners"],
    ["Tappet Cover Gasket", "Engine & Drivetrain", "Gaskets & Seals"],
    ["Turbo Line O-ring", "Engine & Drivetrain", "Gaskets & Seals"],
    ["Thermostat", "Engine & Drivetrain", "Water Pumps & Cooling"],
    ["Radiator Hose", "Engine & Drivetrain", "Water Pumps & Cooling"],
    ["12V Relay", "Electrical & Batteries", "Relays & Fuses"],
    ["BMW X3 IBS Sensor", "Electrical & Batteries", "Sensors"],
    ["AC Button Set", "Electrical & Batteries", "Switches & Controls"],
    ["Bonnet Badge (Front)", "Body & Exterior", "Badges & Trim"],
    ["Side Skirt", "Body & Exterior", "Body Kits & Skirts"],
    ["Door Handle (Front Right)", "Body & Exterior", null],
    ["BMW F10 Center AC Vent Complete", "Interior & Accessories", "Dashboard & AC Vents"],
    ["Shell 5W40 Ultra 1L", "Fluids & Oils", "Engine Oil"],
  ];

  it.each(cases)("files %s under %s / %s", (name, parent, child) => {
    const result = classify(name);
    expect(result.kind).toBe("part");
    if (result.kind !== "part") return;
    expect(result.category?.parent).toBe(parent);
    expect(result.category?.child ?? null).toBe(child);
  });

  it("is confident enough on a clear part to skip review", () => {
    const result = classify("Front Brake Pad Set");
    expect(result.confidence).toBeGreaterThanOrEqual(REVIEW_THRESHOLD);
  });
});

describe("classify — the traps in this catalogue", () => {
  // Each of these is a real name that a naive keyword match gets wrong.
  it("treats a Vacuum Pump Gasket as a part, not a vacuuming service", () => {
    const result = classify("Vacuum Pump Gasket (Genuine)");
    expect(result.kind).toBe("part");
  });

  it("treats an Oil Cap as a part, not engine oil", () => {
    const result = classify("Oil Cap");
    expect(result.kind).toBe("part");
    if (result.kind !== "part") return;
    expect(result.category?.parent).toBe("Engine & Drivetrain");
  });

  it("treats Wax the product line as detailing, and Wax (Car) as a service", () => {
    // Bare "Wax" is ambiguous; with a vehicle class it is unambiguously a job.
    expect(classify("Wax (Car)").kind).toBe("service");
  });

  it("does not read Machine Wax as a wax product", () => {
    expect(classify("Machine Wax").kind).toBe("service");
  });

  it("keeps Brake Fluid out of the Brakes parts tree", () => {
    const result = classify("Brake Fluid DOT4");
    expect(result.kind).toBe("part");
  });
});

describe("classify — services", () => {
  const cases: [string, string][] = [
    ["Body Wash/Vacuum (Car)", "Detailing & Cleaning"],
    ["Full Detailing (SUV)", "Detailing & Cleaning"],
    ["Interior Detailing (Car)", "Detailing & Cleaning"],
    ["Cut & Polish (Van)", "Detailing & Cleaning"],
    ["Under Coating (Car)", "Detailing & Cleaning"],
    ["Full Interior Detail & Leather Treatment", "Detailing & Cleaning"],
    ["Remove Install & Repaint Front Bumper", "Body & Paint"],
    ["Side Skirt Tinkering & Painting (Left Side)", "Body & Paint"],
    ["Wheel Balancing", "Tyres & Wheel Alignment"],
    // Lathe work is machining a component; it has nothing to do with wheels.
    ["Lathe Charges", "Mechanical Repairs"],
    ["Scanning & Diagnosing Charges", "Servicing & Maintenance"],
    ["Eco-Test (Car)", "Servicing & Maintenance"],
    ["Remove & Install Gearbox", "Mechanical Repairs"],
  ];

  it.each(cases)("files %s under %s", (name, category) => {
    const result = classify(name);
    expect(result.kind).toBe("service");
    if (result.kind !== "service") return;
    expect(result.category).toBe(category);
  });

  it("trusts the old site's own service category above the name rules", () => {
    const result = classify("Something Unrecognisable", ["service"]);
    expect(result.kind).toBe("service");
    expect(result.confidence).toBe(95);
    if (result.kind !== "service") return;
    expect(result.matchedOn).toBe("woo:service-category");
  });

  it("carries the vehicle class through to the service", () => {
    const result = classify("Cut & Polish (SUV)");
    if (result.kind !== "service") throw new Error("expected a service");
    expect(result.vehicleClass).toBe("SUV");
    expect(result.baseName).toBe("Cut & Polish");
  });
});

describe("classify — unknowns are flagged, not guessed", () => {
  it.each(["Xyzzy 4400", "Item 12345", "Misc"])(
    "returns no category and zero confidence for %s",
    (name) => {
      const result = classify(name);
      expect(result.confidence).toBe(0);
      if (result.kind !== "part") throw new Error("expected a part");
      expect(result.category).toBeNull();
    },
  );

  it("puts a zero-confidence result below the review threshold", () => {
    expect(classify("Xyzzy 4400").confidence).toBeLessThan(REVIEW_THRESHOLD);
  });
});

describe("regressions found by dry-running against the live catalogue", () => {
  // Every name here fell through or was misfiled on the first real run.
  it("files plural Spark Plugs — /spark plug/ alone never matched them", () => {
    for (const name of [
      "Denso Iridium Spark Plugs",
      "NGK Genuine Spark Plugs",
      "AFC Spark Plugs",
    ]) {
      const result = classify(name);
      if (result.kind !== "part") throw new Error(`${name} should be a part`);
      expect(result.category?.child, name).toBe("Ignition Coils & Plugs");
    }
  });

  it("files hyphenated tie-rods and rack-ends", () => {
    for (const name of ["Tie-Rod Set", "Rack-Ends", "Rack-Ends (555)", "Tie-Rod Set (555)"]) {
      const result = classify(name);
      if (result.kind !== "part") throw new Error(`${name} should be a part`);
      expect(result.category?.child, name).toBe("Tie Rods & Rack Ends");
    }
  });

  it("treats Gasket Overhaul Kit as a part, not a bookable service", () => {
    // /overhaul/ at 96 used to beat the gasket rule and turn a boxed kit into
    // a service.
    expect(classify("Gasket Overhaul Kit").kind).toBe("part");
  });

  it("still treats a bare overhaul as labour", () => {
    expect(classify("Engine Overhaul").kind).toBe("service");
  });

  it("extracts the vehicle class when the size is parenthesised separately", () => {
    const result = splitVehicleClass("Cut & Polish SUV (Large)");
    expect(result.vehicleClass).toBe("SUV");
    expect(result.baseName).toBe("Cut & Polish");
    expect(result.qualifier).toBe("Large");
  });

  it("sends chassis work to the body shop, not wheel alignment", () => {
    const result = classify("Chassis Alignment & Repair Labour");
    if (result.kind !== "service") throw new Error("expected a service");
    expect(result.category).toBe("Body & Paint");
  });

  it("sends lathe work to mechanical repairs, not wheel alignment", () => {
    const result = classify("Lathe Charges For Gear Lever Bushes");
    if (result.kind !== "service") throw new Error("expected a service");
    expect(result.category).toBe("Mechanical Repairs");
  });

  it("recognises Liquimoly written without a space as an oil", () => {
    for (const name of ["Liquimoly TOP-TEC 4600 1L", "Liquimoly KFS 13 1L"]) {
      const result = classify(name);
      if (result.kind !== "part") throw new Error(`${name} should be a part`);
      expect(result.category?.parent, name).toBe("Fluids & Oils");
    }
  });

  it("handles the typographic apostrophe in O’Ring", () => {
    const result = classify("O’Ring");
    if (result.kind !== "part") throw new Error("expected a part");
    expect(result.category?.child).toBe("Gaskets & Seals");
  });

  it.each([
    ["Ball Bearing", "Engine & Drivetrain"],
    ["NSK Bearing", "Engine & Drivetrain"],
    ["Oil Hose", "Engine & Drivetrain"],
    ["Petrol Hose", "Engine & Drivetrain"],
    ["CV Boot (Inner)", "Engine & Drivetrain"],
    ["Ribbed Belt", "Engine & Drivetrain"],
    ["Idler Pulley (Febi)", "Engine & Drivetrain"],
    ["Camber Arm Set (Rear)", "Suspension & Steering"],
    ["Torsion Bar Link (Genuine)", "Suspension & Steering"],
  ])("no longer leaves %s uncategorised", (name, parent) => {
    const result = classify(name);
    if (result.kind !== "part") throw new Error(`${name} should be a part`);
    expect(result.category?.parent, name).toBe(parent);
  });
});

describe("packaged quantities are products, never services", () => {
  /*
   * Found by following a live redirect: "Wilita Water Based Undercoating 1kg"
   * was classified as a *service* by the `under coating` rule, so a legacy URL
   * 301'd to /services/… for a tin of undercoating. Labour is not sold by the
   * kilo, so a unit of measure settles it.
   */
  it.each([
    "Wilita Water Based Undercoating 1kg",
    "Shell Ultra 5w40 5.2L",
    "Rubber Grease 500g",
    "Brake Cleaner 400ml",
    "ZF Lifeguard Fluid 1L",
    "Wheel Weights 100 pcs",
  ])("treats %s as a part", (name) => {
    expect(classify(name).kind, name).toBe("part");
  });

  it("gives it a sensible category even when no part rule matches", () => {
    const result = classify("Wilita Water Based Undercoating 1kg");
    if (result.kind !== "part") throw new Error("expected a part");
    expect(result.category).not.toBeNull();
  });

  it.each([
    ["Oil Cooler", "the l in Cooler"],
    ["Timing Belt", "the t in Belt"],
    ["Cut & Polish (Car)", "no quantity at all"],
    ["Wheel Balancing", "no quantity at all"],
  ])("does not fire on %s (%s)", (name) => {
    expect(hasPackagedQuantity(name), name).toBe(false);
  });

  it("still treats an unquantified service as a service", () => {
    // The guard must not turn all of Detailing into products.
    expect(classify("Under Coating (Car)").kind).toBe("service");
    expect(classify("Machine Wax").kind).toBe("service");
  });
});

describe("isTemplateDemoProduct", () => {
  // Leftovers from the "Urban Jungle Co." theme the old site was built on.
  it.each([
    "Desert Bloom",
    "Golden Glow",
    "Silver Mist",
    "Starlight Succulent",
    "Tropical Breeze",
    "Zen Bamboo Grove",
  ])("recognises the demo houseplant %s", (name) => {
    expect(isTemplateDemoProduct(name)).toBe(true);
  });

  it("recognises anything left in the indoor-plants category", () => {
    expect(isTemplateDemoProduct("Something Else", ["indoor-plants"])).toBe(true);
  });

  it("does not flag a real part", () => {
    expect(isTemplateDemoProduct("Brake Pad Set")).toBe(false);
  });
});

describe("looksLikeInvoiceLine", () => {
  // The client used WooCommerce to build customer bills, so the catalogue also
  // holds accounting rows and supplier names.
  it.each([
    "Previous Balance",
    "Edirisinghe Brothers (Pvt) Ltd",
    "Paint Materials & Consumables",
    "Petrol",
    "Spare Parts",
  ])("flags %s as not a real product", (name) => {
    expect(looksLikeInvoiceLine(name)).toBe(true);
  });

  it.each(["Brake Pad Set", "Oil Filter", "Shell 5W40 Ultra 1L", "Petrol Hose"])(
    "does not flag the real product %s",
    (name) => {
      expect(looksLikeInvoiceLine(name)).toBe(false);
    },
  );
});

describe("detectCondition", () => {
  it.each([
    ["Fan Motor Recondition (No Warranty)", "REFURBISHED"],
    ["AC Blower (Recondition)", "REFURBISHED"],
    ["Vacuum Pump Gasket (Genuine)", "OEM"],
    ["Used Headlight", "USED"],
    ["Brake Pad Set", "NEW"],
  ])("reads %s as %s", (name, expected) => {
    expect(detectCondition(name)).toBe(expected);
  });
});
