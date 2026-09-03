/**
 * Classify a migrated WooCommerce product from its name alone.
 *
 * This carries more weight than it looks. 935 of the old site's 955 products
 * are `uncategorized` and none has a SKU or description, so the product *name*
 * is very nearly the only signal available — these rules are doing all of the
 * categorisation, not merely assisting a human.
 *
 * Because of that, the design is deliberately cautious: rules are ordered
 * most-specific first, each carries a confidence, and anything scoring below
 * `REVIEW_THRESHOLD` is flagged into the admin's "Needs review" queue instead
 * of being filed silently in the wrong place.
 */

import type { VehicleClass } from "@/generated/prisma/enums";

/** Below this confidence, a human is asked to confirm. */
export const REVIEW_THRESHOLD = 70;

export type CategoryTarget = {
  /** Top-level category name, matching the seeded tree. */
  parent: string;
  /** Subcategory name, or null to file directly under the parent. */
  child: string | null;
};

export type PartClassification = {
  kind: "part";
  category: CategoryTarget | null;
  confidence: number;
  matchedOn: string | null;
};

export type ServiceClassification = {
  kind: "service";
  /** Service category name from the seeded service categories. */
  category: string;
  /** Name with any vehicle-class suffix removed, e.g. "Cut & Polish". */
  baseName: string;
  vehicleClass: VehicleClass | null;
  confidence: number;
  matchedOn: string | null;
};

export type Classification = PartClassification | ServiceClassification;

type Rule = {
  /** Tested against the lowercased product name. */
  pattern: RegExp;
  parent: string;
  child?: string;
  confidence: number;
};

/**
 * Part rules. The **highest-confidence** match wins, not the first.
 *
 * That distinction matters: with first-match-wins, the generic
 * "bushes & mounts" rule (80) filed "Suzuki Swift K12 Engine Mount" under
 * suspension purely because it appeared earlier in the list than the specific
 * "engine mount" rule (94). Scoring by confidence makes the table order
 * irrelevant, so adding a rule can no longer break an unrelated one.
 *
 * Word boundaries matter too: an unanchored /wash/ would file "Washer Bottle"
 * under detailing, and an unanchored /vacuum/ would file "Vacuum Pump Gasket"
 * as a car wash. Both are real names in this catalogue.
 */
const PART_RULES: Rule[] = [
  // ---------- Filters ----------
  { pattern: /\boil filter\b/, parent: "Filters", child: "Oil Filters", confidence: 96 },
  { pattern: /\bair filter\b/, parent: "Filters", child: "Air Filters", confidence: 96 },
  { pattern: /\bfuel filter\b/, parent: "Filters", child: "Fuel Filters", confidence: 96 },
  {
    pattern: /\b(cabin|a\/?c|ac|pollen)\s*filter\b/,
    parent: "Filters",
    child: "Cabin & AC Filters",
    confidence: 94,
  },
  { pattern: /\bfilter\b/, parent: "Filters", confidence: 74 },

  // ---------- Brakes ----------
  {
    pattern: /\bbrake\s*(pad|pads|pad set|shoe|shoes)\b/,
    parent: "Brakes",
    child: "Brake Pads",
    confidence: 96,
  },
  {
    pattern: /\b(brake\s*(disc|discs|rotor|rotors|drum|drums)|disc rotor)\b/,
    parent: "Brakes",
    child: "Brake Discs & Drums",
    confidence: 95,
  },
  {
    pattern: /\bbrake\s*(hose|hoses|pipe|line|lines)\b/,
    parent: "Brakes",
    child: "Brake Hoses & Lines",
    confidence: 95,
  },
  {
    pattern: /\b(master cylinder|wheel cylinder|brake booster)\b/,
    parent: "Brakes",
    child: "Master & Wheel Cylinders",
    confidence: 93,
  },
  {
    pattern: /\b(hand\s*brake|parking brake)\b/,
    parent: "Brakes",
    child: "Handbrake Parts",
    confidence: 92,
  },
  { pattern: /\b(caliper|brake fluid|abs sensor)\b/, parent: "Brakes", confidence: 84 },
  { pattern: /\bbrake\b/, parent: "Brakes", confidence: 78 },

  // ---------- Suspension & steering ----------
  {
    pattern: /\b(shock absorber|shock absorbers|strut|struts|damper)\b/,
    parent: "Suspension & Steering",
    child: "Shock Absorbers & Struts",
    confidence: 94,
  },
  {
    pattern: /\b(coil spring|leaf spring|suspension spring)\b/,
    parent: "Suspension & Steering",
    child: "Springs",
    confidence: 92,
  },
  {
    pattern: /\b(lower arm|upper arm|control arm|ball joint|ball joints|wishbone)\b/,
    parent: "Suspension & Steering",
    child: "Control Arms & Ball Joints",
    confidence: 93,
  },
  {
    // Hyphenated in the source data too: "Tie-Rod Set", "Rack-Ends".
    pattern: /\b(tie[- ]?rods?|rack[- ]?ends?|tie[- ]?bar|drag link|camber arm|torsion bar)\b/,
    parent: "Suspension & Steering",
    child: "Tie Rods & Rack Ends",
    confidence: 94,
  },
  {
    pattern: /\b(stabilizer|stabiliser|sway bar|anti[- ]?roll)\b.*\b(link|links)\b/,
    parent: "Suspension & Steering",
    child: "Stabiliser Links",
    confidence: 92,
  },
  {
    pattern: /\b(bush|bushes|bushing|bushings|mount|mounts|mounting)\b/,
    parent: "Suspension & Steering",
    child: "Bushes & Mounts",
    confidence: 80,
  },
  {
    pattern: /\b(steering rack|power steering|steering pump|steering box)\b/,
    parent: "Suspension & Steering",
    child: "Power Steering",
    confidence: 92,
  },
  {
    // Bare "shock"/"damper": "Shock Dampers", "Boot Shock Spring L",
    // "Dicky Shock Set" all arrived with no category.
    pattern: /\b(shocks?|dampers?)\b/,
    parent: "Suspension & Steering",
    child: "Shock Absorbers & Struts",
    confidence: 82,
  },
  {
    pattern: /\b(dust cover|dust boot)\b/,
    parent: "Suspension & Steering",
    child: "Shock Absorbers & Struts",
    confidence: 84,
  },
  {
    pattern: /\bsprings?\b/,
    parent: "Suspension & Steering",
    child: "Springs",
    confidence: 78,
  },
  {
    // "Hub Razor" is the local term for a hub/bearing assembly.
    pattern: /\b(hub razor|hub assy|hub assembly|wheel bearing|hub bearing|steering|suspension)\b/,
    parent: "Suspension & Steering",
    confidence: 80,
  },

  // ---------- Engine & drivetrain ----------
  {
    pattern: /\b(timing (belt|chain|gear|idler|adjuster)|cam belt|tensioner|belt adjuster)\b/,
    parent: "Engine & Drivetrain",
    child: "Timing Components",
    confidence: 92,
  },
  {
    pattern: /\b(idler pulley|pulley|idler)\b/,
    parent: "Engine & Drivetrain",
    child: "Belts & Tensioners",
    confidence: 88,
  },
  {
    // "Ball Bearing", "NSK Bearing", "Pilot Bearing", "Shock Bearing" — all
    // real names that previously fell through with no category at all.
    pattern: /\bbearings?\b/,
    parent: "Engine & Drivetrain",
    confidence: 79,
  },
  {
    // Generic hoses. Brake hoses are caught earlier at 95, and coolant and
    // radiator hoses by the cooling rule at 91, so this picks up the rest:
    // "Oil Hose", "Water Hose", "Petrol Hose", "Breather Hose".
    pattern: /\b(hose|pipe)\b/,
    parent: "Engine & Drivetrain",
    confidence: 77,
  },
  {
    // Rubber boots protect a joint — drivetrain and suspension wear parts.
    pattern: /\b(cv boot|rack boot|shock boot|dust boot|drive shaft boot)\b/,
    parent: "Engine & Drivetrain",
    child: "Gaskets & Seals",
    confidence: 88,
  },
  {
    pattern: /\b(washer|washers|copper washer|circlip|split pin)\b/,
    parent: "Engine & Drivetrain",
    child: "Gaskets & Seals",
    confidence: 76,
  },
  {
    // Above the bare "alternator" rule (92): "5PK Alternator Belt" is a belt
    // that drives the alternator, not an alternator.
    pattern: /\b(alternator belt|fan belt|drive belt|ribbed belt|v[- ]?belt|\d+pk\b|serpentine)\b/,
    parent: "Engine & Drivetrain",
    child: "Belts & Tensioners",
    confidence: 95,
  },
  {
    pattern: /\bengine mount|gearbox mount|transmission mount\b/,
    parent: "Engine & Drivetrain",
    child: "Engine Mounts",
    confidence: 94,
  },
  {
    // Above "Turbo & Intake" (90): "Turbo Line O-ring" is a seal, and the part
    // a customer is replacing is the ring, not the turbo.
    //
    // The apostrophe class covers "O’Ring" — the catalogue contains it with a
    // typographic U+2019, which a plain /o-?ring/ misses.
    pattern: /\b(gaskets?|packing|seals?|o['’\- ]?rings?|oil seal)\b/,
    parent: "Engine & Drivetrain",
    child: "Gaskets & Seals",
    confidence: 91,
  },
  {
    pattern: /\b(clutch|pressure plate|release bearing|clutch plate)\b/,
    parent: "Engine & Drivetrain",
    child: "Clutch & Pressure Plates",
    confidence: 93,
  },
  {
    pattern: /\b(water pump|radiator|thermostat|coolant hose|radiator hose|fan motor|cooling fan)\b/,
    parent: "Engine & Drivetrain",
    child: "Water Pumps & Cooling",
    confidence: 91,
  },
  {
    pattern: /\b(turbo|turbocharger|intercooler|intake manifold|throttle body|air intake)\b/,
    parent: "Engine & Drivetrain",
    child: "Turbo & Intake",
    confidence: 90,
  },
  {
    pattern: /\b(exhaust|muffler|silencer|catalytic|lambda|oxygen sensor|egr)\b/,
    parent: "Engine & Drivetrain",
    child: "Exhaust & Emissions",
    confidence: 90,
  },
  {
    pattern: /\b(piston|crankshaft|camshaft|cylinder head|valve|tappet|con rod|flywheel|gearbox|axle|cv joint|differential|oil pump|oil cap|vvti|vvt)\b/,
    parent: "Engine & Drivetrain",
    confidence: 82,
  },

  // ---------- Electrical ----------
  {
    pattern: /\bbattery|batteries\b/,
    parent: "Electrical & Batteries",
    child: "Batteries",
    confidence: 94,
  },
  {
    pattern: /\b(alternator|starter motor|starter|dynamo)\b/,
    parent: "Electrical & Batteries",
    child: "Alternators & Starters",
    confidence: 92,
  },
  {
    pattern: /\b(relay|fuse|fuse box|fusebox)\b/,
    parent: "Electrical & Batteries",
    child: "Relays & Fuses",
    confidence: 92,
  },
  {
    pattern: /\b(sensor|sensors)\b/,
    parent: "Electrical & Batteries",
    child: "Sensors",
    confidence: 86,
  },
  {
    pattern: /\b(switch|switches|button|buttons)\b/,
    parent: "Electrical & Batteries",
    child: "Switches & Controls",
    confidence: 84,
  },
  {
    pattern: /\b(wiring|harness|connector|cable|socket)\b/,
    parent: "Electrical & Batteries",
    child: "Wiring & Connectors",
    confidence: 85,
  },
  {
    // `plugs?` matters: /\bspark plug\b/ never matched "Spark Plugs", which is
    // how every one of these is actually written in the catalogue.
    pattern: /\b(ignition coils?|spark plugs?|glow plugs?|coil packs?|distributor)\b/,
    parent: "Electrical & Batteries",
    child: "Ignition Coils & Plugs",
    confidence: 93,
  },
  {
    pattern: /\b(module|ecu|ecm|actuator|motor|solenoid|horn|wiper motor)\b/,
    parent: "Electrical & Batteries",
    confidence: 76,
  },

  // ---------- Lighting ----------
  {
    pattern: /\b(head\s*light|head\s*lamp|headlamp)\b/,
    parent: "Lighting",
    child: "Headlights",
    confidence: 94,
  },
  {
    pattern: /\b(tail\s*light|tail\s*lamp|rear lamp|stop lamp|brake light)\b/,
    parent: "Lighting",
    child: "Tail Lights",
    confidence: 93,
  },
  {
    pattern: /\b(indicator|signal lamp|side lamp|blinker)\b/,
    parent: "Lighting",
    child: "Indicators & Side Lamps",
    confidence: 91,
  },
  {
    pattern: /\b(fog light|fog lamp|spot light|work light)\b/,
    parent: "Lighting",
    child: "Fog & Auxiliary Lights",
    confidence: 91,
  },
  { pattern: /\b(bulb|bulbs|led|light|lamp)\b/, parent: "Lighting", child: "Bulbs & LEDs", confidence: 78 },

  // ---------- Body & exterior ----------
  {
    pattern: /\b(bumper|grille|grill)\b/,
    parent: "Body & Exterior",
    child: "Bumpers & Grilles",
    confidence: 93,
  },
  {
    pattern: /\b(fender|guard|quarter panel|door panel|door skin|side panel)\b/,
    parent: "Body & Exterior",
    child: "Fenders & Panels",
    confidence: 90,
  },
  {
    pattern: /\b(mirror|mirrors|side mirror|wing mirror)\b/,
    parent: "Body & Exterior",
    child: "Mirrors",
    confidence: 93,
  },
  {
    pattern: /\b(bonnet|hood|boot lid|tail gate|tailgate|trunk)\b/,
    parent: "Body & Exterior",
    child: "Bonnets & Boots",
    confidence: 90,
  },
  // Above "Bonnets & Boots" (90) on purpose: in "Bonnet Badge" the badge is
  // the noun and the bonnet is only telling you where it goes.
  {
    pattern: /\b(badge|emblem)\b/,
    parent: "Body & Exterior",
    child: "Badges & Trim",
    confidence: 92,
  },
  {
    pattern: /\b(moulding|molding|trim|garnish)\b/,
    parent: "Body & Exterior",
    child: "Badges & Trim",
    confidence: 86,
  },
  {
    pattern: /\b(wiper blade|wiper blades|wiper arm|wiper)\b/,
    parent: "Body & Exterior",
    child: "Wipers",
    confidence: 90,
  },
  {
    pattern: /\b(windscreen|windshield|window glass|weather strip|door rubber|glass)\b/,
    parent: "Body & Exterior",
    child: "Glass & Weather Strips",
    confidence: 88,
  },
  {
    pattern: /\b(side skirt|body kit|spoiler|diffuser|lip)\b/,
    parent: "Body & Exterior",
    child: "Body Kits & Skirts",
    confidence: 89,
  },
  {
    pattern: /\b(door handle|door lock|hinge|door)\b/,
    parent: "Body & Exterior",
    confidence: 80,
  },

  // ---------- Interior ----------
  {
    pattern: /\b(seat cover|seat covers|cushion|head rest|headrest)\b/,
    parent: "Interior & Accessories",
    child: "Seat Covers & Cushions",
    confidence: 91,
  },
  {
    pattern: /\b(floor mat|floor mats|carpet|foot mat)\b/,
    parent: "Interior & Accessories",
    child: "Floor Mats",
    confidence: 92,
  },
  {
    pattern: /\b(a\/?c vent|ac vent|air vent|dashboard|dash board|meter cluster)\b/,
    parent: "Interior & Accessories",
    child: "Dashboard & AC Vents",
    confidence: 90,
  },
  {
    pattern: /\b(steering wheel|steering cover|gear knob)\b/,
    parent: "Interior & Accessories",
    child: "Steering Wheels & Covers",
    confidence: 90,
  },
  {
    pattern: /\b(speaker|head unit|android|dvd|reverse camera|audio|amplifier|subwoofer)\b/,
    parent: "Interior & Accessories",
    child: "Audio & Multimedia",
    confidence: 89,
  },
  {
    pattern: /\b(phone (holder|mount)|charger|usb|dash cam|dashcam)\b/,
    parent: "Interior & Accessories",
    child: "Phone Mounts & Chargers",
    confidence: 89,
  },
  {
    pattern: /\b(organiser|organizer|arm rest|armrest|sun shade|curtain)\b/,
    parent: "Interior & Accessories",
    child: "Storage & Organisers",
    confidence: 85,
  },

  // ---------- Wheels & tyres ----------
  {
    pattern: /\b(alloy wheel|alloy wheels|rim|rims)\b/,
    parent: "Wheels & Tyres",
    child: "Alloy Wheels",
    confidence: 91,
  },
  {
    pattern: /\b(wheel cap|wheel caps|hub cap|wheel nut|wheel nuts|wheel bolt|centre cap)\b/,
    parent: "Wheels & Tyres",
    child: "Wheel Caps & Nuts",
    confidence: 91,
  },
  { pattern: /\b(tyre|tyres|tire|tires)\b/, parent: "Wheels & Tyres", child: "Tyres", confidence: 92 },
  {
    pattern: /\b(tyre valve|tpms|valve stem)\b/,
    parent: "Wheels & Tyres",
    child: "Valves & Sensors",
    confidence: 89,
  },

  // ---------- Fluids & oils ----------
  {
    // "Liquimoly" is written without a space in this catalogue, and their
    // product lines ("TOP-TEC 4600", "KFS 13") carry no other clue.
    pattern: /\b(\d+w[- ]?\d+|engine oil|motor oil|shell|castrol|mobil|liqui ?moly|top[- ]?tec|total quartz)\b/,
    parent: "Fluids & Oils",
    child: "Engine Oil",
    confidence: 90,
  },
  {
    // Automatic and CVT fluids are a big slice of this catalogue and are named
    // by brand and product line as often as by type: "Honda DW-1",
    // "ZF Lifeguard Fluid 1L", "Valvoline Max Life 4L".
    pattern: /\b(gear ?oil|transmission (fluid|oil)|cvt ?fluid|cvtf|atf|differential oil|lifeguard|dw-?1|max ?life|valvoline)\b/,
    parent: "Fluids & Oils",
    child: "Gear & Transmission Oil",
    confidence: 91,
  },
  {
    pattern: /\b(glue|epoxy|apoxy|silastic|silicone?|thread ?lock|sealant)\b/,
    parent: "Fluids & Oils",
    child: "Greases & Additives",
    confidence: 84,
  },
  {
    pattern: /\bbrake fluid|dot ?[34]\b/,
    parent: "Fluids & Oils",
    child: "Brake Fluid",
    confidence: 92,
  },
  {
    pattern: /\b(coolant|antifreeze|radiator fluid)\b/,
    parent: "Fluids & Oils",
    child: "Coolant",
    confidence: 91,
  },
  {
    pattern: /\b(grease|additive|octane|injector cleaner|stop leak)\b/,
    parent: "Fluids & Oils",
    child: "Greases & Additives",
    confidence: 87,
  },

  // ---------- Car care ----------
  {
    pattern: /\b(shampoo|car wash liquid|snow foam|wash and wax)\b/,
    parent: "Car Care & Detailing",
    child: "Shampoos & Washes",
    confidence: 90,
  },
  {
    pattern: /\b(polish|compound|wax)\b/,
    parent: "Car Care & Detailing",
    child: "Polishes & Waxes",
    confidence: 84,
  },
  {
    pattern: /\b(interior cleaner|dashboard polish|leather cleaner|upholstery cleaner)\b/,
    parent: "Car Care & Detailing",
    child: "Interior Cleaners",
    confidence: 90,
  },
  {
    pattern: /\b(ceramic coating|sealant|graphene)\b/,
    parent: "Car Care & Detailing",
    child: "Coatings & Sealants",
    confidence: 89,
  },
  {
    pattern: /\b(microfibre|microfiber|applicator|sponge|cloth|towel)\b/,
    parent: "Car Care & Detailing",
    child: "Cloths & Applicators",
    confidence: 87,
  },
  {
    // "Air Freshner" and "Air freshner" both appear — a loose suffix match is
    // the only way to catch the misspelling as well as the correct spelling.
    pattern: /\bair\s*fresh\w*|\b(perfume|deodoriser)\b/,
    parent: "Car Care & Detailing",
    child: "Air Fresheners",
    confidence: 90,
  },
  {
    pattern: /\b(degreaser|carburet+or cleaner|brake cleaner|contact cleaner|engine cleaner)\b/,
    parent: "Car Care & Detailing",
    confidence: 86,
  },
];

/**
 * Labour rules. Deliberately narrow: a false positive turns a sellable part
 * into a bookable service, which is a worse mistake than leaving it as a part
 * for someone to reclassify.
 */
const SERVICE_RULES: { pattern: RegExp; category: string; confidence: number }[] = [
  // Note there is no bare /vacuum/ here. It matched "Vacuum Pump Gasket" — a
  // part — and outscored the gasket rule. "Body Wash/Vacuum (Car)" is caught
  // by "body wash" anyway, and anything genuinely named "Vacuuming (Car)" is
  // caught by the vehicle-class rule in `classify`.
  {
    pattern: /\b(body wash|under wash|engine wash|exterior wash|full wash)\b/,
    category: "Detailing & Cleaning",
    confidence: 92,
  },
  {
    pattern: /\b(detailing|full detail|interior detail|exterior detail|machine wax|cut ?(&|and) ?polish|leather treatment)\b/,
    category: "Detailing & Cleaning",
    confidence: 93,
  },
  {
    pattern: /\b(under coating|undercoating|rust ?proofing|ceramic coating service)\b/,
    category: "Detailing & Cleaning",
    confidence: 88,
  },
  // These verbs beat every part rule on purpose. A name like "Remove Install &
  // Repaint Front Bumper" contains a part noun ("bumper", 93) but describes
  // work done *to* it, so the verb has to win.
  {
    // `painting` on its own is needed for "Front Panel Painting". It cannot
    // catch "Paint Materials & Consumables", which has no -ing form.
    pattern: /\b(repaint|re-paint|spray paint(ing)?|painting|paint job|tinkering|tinker|panel beating|denting)\b/,
    category: "Body & Paint",
    confidence: 97,
  },
  {
    pattern: /\b(welding|weld)\b/,
    category: "Body & Paint",
    confidence: 90,
  },
  {
    pattern: /\b(buffing|polishing)\b/,
    category: "Detailing & Cleaning",
    confidence: 88,
  },
  {
    pattern: /\b(acid removal|tar removal|stain removal|odour removal)\b/,
    category: "Detailing & Cleaning",
    confidence: 88,
  },
  {
    pattern: /\b(tune ?up|top ?up|gas charge|a\/?c gas|regas|re-gas)\b/,
    category: "Servicing & Maintenance",
    confidence: 86,
  },
  {
    pattern: /\b(injector test|test (&|and) service|fixing|setup|fitting)\b/,
    category: "Mechanical Repairs",
    confidence: 80,
  },
  {
    // Narrower than it looks: "Washer" does not contain the word "wash", so
    // "Washer Bottle" and "Wiper Washer Motor" are unaffected.
    pattern: /\b(bike wash|car wash|wash)\b/,
    category: "Detailing & Cleaning",
    confidence: 74,
  },
  {
    pattern: /\b(remove (&|and)? ?install|remove, ?install|r ?& ?i)\b/,
    category: "Mechanical Repairs",
    confidence: 96,
  },
  {
    /*
     * Split out of the rule above and dropped to 78. At 96 it misfiled
     * "Gasket Overhaul Kit" — a boxed part — as a bookable service, because
     * "overhaul" here is part of a product name rather than a verb. At 78 the
     * gasket rule (91) correctly wins, while a bare "Engine Overhaul" with no
     * competing part noun still comes through as labour.
     */
    pattern: /\b(overhaul|refit|reassembl)/,
    category: "Mechanical Repairs",
    confidence: 78,
  },
  {
    pattern: /\b(wheel alignment|wheel balancing|tyre balancing|four wheel alignment|balancing)\b/,
    category: "Tyres & Wheel Alignment",
    confidence: 92,
  },
  {
    // Chassis straightening is body-shop work, not wheel alignment — a bare
    // /alignment/ rule sent "Chassis Alignment & Repair Labour" to the wrong
    // department.
    pattern: /\b(chassis|body ?shop|panel work)\b/,
    category: "Body & Paint",
    confidence: 90,
  },
  {
    pattern: /\balignment\b/,
    category: "Tyres & Wheel Alignment",
    confidence: 80,
  },
  {
    // Lathe work is machining a component, not anything to do with wheels.
    pattern: /\b(lathe|machining|skim(ming)?|boring|honing)\b/,
    category: "Mechanical Repairs",
    confidence: 86,
  },
  {
    pattern: /\b(scanning|diagnos(is|ing|tic)|eco[- ]?test|emission test)\b/,
    category: "Servicing & Maintenance",
    confidence: 88,
  },
  {
    /*
     * "Labour charge" as a phrase is decisive and must outrank part nouns.
     * At the generic 76 below, "Labor Charge For Dual Clutch Oil Change" lost
     * to the clutch rule (93) and was imported as a sellable clutch.
     */
    pattern: /\b(labour|labor) charge\b/,
    category: "Mechanical Repairs",
    confidence: 95,
  },
  {
    pattern: /\b(charges?|labour|labor|service charge)\b/,
    category: "Mechanical Repairs",
    confidence: 76,
  },
  // Left below the part rules on purpose. "Steering Rack Bush Repair" and
  // "Caliper Pin Repair" are ambiguous — they read as either a repair job or a
  // repair kit — so they stay parts and get flagged for review rather than
  // being turned into bookable services on a guess.
  {
    pattern: /\brepair\b/,
    category: "Mechanical Repairs",
    confidence: 72,
  },
  // Detailing nouns with no verb. Low on its own — "Wax" could be a tin of wax
  // on the shelf — but decisive once a vehicle class is attached.
  {
    pattern: /\b(wax|polish|coating|shampoo|clean(ing)?)\b/,
    category: "Detailing & Cleaning",
    confidence: 60,
  },
];

/*
 * The hyphen is escaped deliberately. Written as `[\s(\[-–—]` the `-` between
 * `\[` and `–` is parsed as a *range* from U+005B to U+2013, which covers every
 * ASCII letter and digit — so the separator class silently ate whole words and
 * "Cut & Polish (SUV)" came back as "Cut &".
 */
const VEHICLE_CLASS_PATTERN =
  /[\s(\[\-–—]+(car|van|suv|cab|lorry|truck|bike|motor\s*bike|motorcycle)\s*\)?\s*(?:\(?\s*(large|small|medium)\s*\)?)?\s*[)\]]?\s*$/i;

const CLASS_LOOKUP: Record<string, VehicleClass> = {
  car: "CAR",
  van: "VAN",
  suv: "SUV",
  cab: "CAB",
  lorry: "LORRY",
  truck: "LORRY",
  bike: "MOTORCYCLE",
  motorbike: "MOTORCYCLE",
  motorcycle: "MOTORCYCLE",
};

/**
 * Split a trailing vehicle class off a name.
 *
 * The old catalogue sells one job as several products — "Cut & Polish (Car)",
 * "(Van)", "(SUV)" — so this is what lets three products collapse into one
 * service with three prices.
 */
export function splitVehicleClass(name: string): {
  baseName: string;
  vehicleClass: VehicleClass | null;
  /** e.g. "Large" from "SUV Large", kept so the distinction is not lost. */
  qualifier: string | null;
} {
  const match = name.match(VEHICLE_CLASS_PATTERN);
  if (!match) return { baseName: name.trim(), vehicleClass: null, qualifier: null };

  const key = match[1].toLowerCase().replace(/\s+/g, "");
  const vehicleClass = CLASS_LOOKUP[key] ?? null;
  if (!vehicleClass) return { baseName: name.trim(), vehicleClass: null, qualifier: null };

  return {
    baseName: name.slice(0, match.index).replace(/[\s(\[\-–—]+$/, "").trim(),
    vehicleClass,
    qualifier: match[2]?.trim() || null,
  };
}

/** True when the old site filed this product under its `service` category. */
function hasServiceCategory(categorySlugs: readonly string[]): boolean {
  return categorySlugs.includes("service");
}

/**
 * Decide whether a product is a part or a service, and where it belongs.
 *
 * `categorySlugs` are the old site's own categories, which are trusted when
 * present — but only 2% of products have any.
 */
/** The highest-confidence matching rule, or null when none match. */
function bestMatch<T extends { pattern: RegExp; confidence: number }>(
  rules: readonly T[],
  haystack: string,
): T | null {
  let best: T | null = null;
  for (const rule of rules) {
    if (!rule.pattern.test(haystack)) continue;
    if (!best || rule.confidence > best.confidence) best = rule;
  }
  return best;
}

export function classify(
  rawName: string,
  categorySlugs: readonly string[] = [],
): Classification {
  const name = rawName.trim();
  const haystack = name.toLowerCase();
  const { baseName, vehicleClass } = splitVehicleClass(name);

  const serviceRule = bestMatch(SERVICE_RULES, haystack);
  const partRule = bestMatch(PART_RULES, haystack);

  // The old site's own `service` category is authoritative when set — but only
  // 1 of 955 products actually has it.
  if (hasServiceCategory(categorySlugs)) {
    return {
      kind: "service",
      category: serviceRule?.category ?? "Servicing & Maintenance",
      baseName,
      vehicleClass,
      confidence: 95,
      matchedOn: "woo:service-category",
    };
  }

  /*
   * A trailing vehicle class settles it. Nothing in this catalogue sells a
   * *part* as "(Car) / (Van) / (SUV)" — that suffix exists precisely because
   * labour is priced by vehicle size. All 23 such products are jobs, so the
   * suffix is treated as decisive rather than as a mere nudge; that is what
   * turns a bare "Wax (Car)" into a service instead of a tin of wax.
   */
  if (vehicleClass) {
    return {
      kind: "service",
      category: serviceRule?.category ?? "Detailing & Cleaning",
      baseName,
      vehicleClass,
      confidence: Math.max(88, serviceRule?.confidence ?? 0),
      matchedOn: serviceRule ? serviceRule.pattern.source : "vehicle-class-suffix",
    };
  }

  const serviceScore = serviceRule?.confidence ?? -1;
  const partScore = partRule?.confidence ?? -1;

  if (serviceRule && serviceScore >= partScore) {
    return {
      kind: "service",
      category: serviceRule.category,
      baseName,
      vehicleClass,
      confidence: serviceScore,
      matchedOn: serviceRule.pattern.source,
    };
  }

  if (partRule) {
    return {
      kind: "part",
      category: { parent: partRule.parent, child: partRule.child ?? null },
      confidence: partRule.confidence,
      matchedOn: partRule.pattern.source,
    };
  }

  return { kind: "part", category: null, confidence: 0, matchedOn: null };
}

/**
 * Products that came from the WordPress theme's demo content rather than the
 * business.
 *
 * The old site was built on an "Urban Jungle Co." plant-shop template that was
 * never fully rebranded, and six houseplants are still sitting in the
 * catalogue. Importing them would put "Zen Bamboo Grove" in a vehicle spare
 * parts shop.
 */
const TEMPLATE_DEMO_PRODUCTS = new Set([
  "desert bloom",
  "golden glow",
  "silver mist",
  "starlight succulent",
  "tropical breeze",
  "zen bamboo grove",
]);

export function isTemplateDemoProduct(
  name: string,
  categorySlugs: readonly string[] = [],
): boolean {
  return (
    categorySlugs.includes("indoor-plants") ||
    TEMPLATE_DEMO_PRODUCTS.has(name.trim().toLowerCase())
  );
}

/**
 * Entries that are invoice line items rather than things on a shelf.
 *
 * The client has clearly been using WooCommerce to build customer bills, so the
 * "catalogue" also contains supplier names, carried-forward balances and
 * unpriced fuel. These are imported but deactivated and flagged, so nothing the
 * client typed is destroyed while none of it reaches the public site.
 */
const NOT_A_PRODUCT_PATTERNS: RegExp[] = [
  /\b(previous|opening|closing) balance\b/i,
  /\b(pvt|private) ?\)? ?ltd\b/i,
  /\b(advance|deposit|discount|round(ing)? off|balance b\/?f|balance payment)\b/i,
  /^(re|bmw spares|spares|payment|settlement)$/i,
  /^(petrol|diesel|fuel|spare parts|parts|misc|miscellaneous|others?|sundry)$/i,
  /\b(materials? (&|and) consumables?|consumables?)\b/i,
  /^(labour|labor|transport|delivery|courier)$/i,
];

export function looksLikeInvoiceLine(name: string): boolean {
  const n = name.trim();
  return NOT_A_PRODUCT_PATTERNS.some((p) => p.test(n));
}

/**
 * A part whose name still reads like labour.
 *
 * "Caliper Pin Repair", "Steering Rack Bush Repair" and the like are genuinely
 * ambiguous — a repair *job* or a repair *kit* — and the part rules win them on
 * confidence, so they arrive as products with no low-confidence flag to catch
 * them. Rather than guess, they are marked so the review queue surfaces them
 * and a human decides.
 */
const AMBIGUOUS_LABOUR = /\b(repair|charges?|labour|labor|install|fitting|servicing)\b/i;

export function readsLikeLabour(name: string): boolean {
  return AMBIGUOUS_LABOUR.test(name);
}

/** Products described as reconditioned or used, for the `condition` field. */
export function detectCondition(
  name: string,
): "NEW" | "USED" | "REFURBISHED" | "OEM" | "AFTERMARKET" {
  const n = name.toLowerCase();
  if (/\b(recondition|reconditioned|refurbish|rebuilt)\b/.test(n)) return "REFURBISHED";
  if (/\b(used|second hand|2nd hand)\b/.test(n)) return "USED";
  if (/\b(genuine|oem|original)\b/.test(n)) return "OEM";
  if (/\b(aftermarket|replica)\b/.test(n)) return "AFTERMARKET";
  return "NEW";
}
