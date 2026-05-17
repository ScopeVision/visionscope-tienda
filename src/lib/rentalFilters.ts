// Centralised definition of category-aware filter options for the rental catalog.
// These keys are persisted in the products table (brand, mount, sensor_type, coverage, ...).

export type FilterOption = { value: string; labelKey: string };

export const BRANDS: FilterOption[] = [
  { value: "arri", labelKey: "ARRI" },
  { value: "red", labelKey: "RED" },
  { value: "sony", labelKey: "Sony" },
  { value: "blackmagic", labelKey: "Blackmagic" },
  { value: "canon", labelKey: "Canon" },
  { value: "panasonic", labelKey: "Panasonic" },
  { value: "zeiss", labelKey: "Zeiss" },
  { value: "cooke", labelKey: "Cooke" },
  { value: "angenieux", labelKey: "Angénieux" },
  { value: "leica", labelKey: "Leica" },
  { value: "nikon", labelKey: "Nikon" },
  { value: "sigma", labelKey: "Sigma" },
  { value: "tokina", labelKey: "Tokina" },
  { value: "schneider", labelKey: "Schneider" },
  { value: "laowa", labelKey: "Laowa" },
  { value: "dzofilm", labelKey: "DZOFilm" },
  { value: "atlas", labelKey: "Atlas" },
  { value: "tribe7", labelKey: "Tribe7" },
  { value: "vantage", labelKey: "Vantage" },
  { value: "panavision", labelKey: "Panavision" },
];

export const SENSOR_TYPES: FilterOption[] = [
  { value: "fullframe", labelKey: "rental.dyn.sensor.fullframe" },
  { value: "super35", labelKey: "rental.dyn.sensor.super35" },
  { value: "large_format", labelKey: "rental.dyn.sensor.largeformat" },
];

// Professional cinema mounts (cameras + lenses share the same canonical list).
export const MOUNTS: FilterOption[] = [
  // ARRI
  { value: "arri_pl", labelKey: "ARRI PL" },
  { value: "arri_lpl", labelKey: "ARRI LPL" },
  { value: "arri_standard", labelKey: "ARRI Standard" },
  { value: "arri_bayonet", labelKey: "ARRI Bayonet" },
  // Canon
  { value: "canon_ef", labelKey: "Canon EF" },
  { value: "canon_rf", labelKey: "Canon RF" },
  { value: "canon_fd", labelKey: "Canon FD" },
  // Sony
  { value: "sony_e", labelKey: "Sony E" },
  // Nikon
  { value: "nikon_f", labelKey: "Nikon F" },
  { value: "nikon_z", labelKey: "Nikon Z" },
  // Leica
  { value: "leica_m", labelKey: "Leica M" },
  { value: "leica_r", labelKey: "Leica R" },
  { value: "leica_l", labelKey: "Leica L" },
  // Otras
  { value: "panavision_pv", labelKey: "Panavision PV" },
  { value: "b4", labelKey: "B4" },
  { value: "c_mount", labelKey: "C-Mount" },
  { value: "oct19", labelKey: "OCT-19" },
  { value: "m42", labelKey: "M42" },
  { value: "mft", labelKey: "Micro Four Thirds" },
  { value: "l39", labelKey: "L39 / LTM" },
];

// Coverage / format (digital + film + anamorphic).
export const COVERAGE_FORMATS: FilterOption[] = [
  // Digital
  { value: "fullframe", labelKey: "rental.dyn.cov.fullframe" },
  { value: "super35", labelKey: "rental.dyn.cov.super35" },
  { value: "apsc", labelKey: "APS-C" },
  { value: "vistavision", labelKey: "VistaVision" },
  { value: "large_format", labelKey: "rental.dyn.cov.largeformat" },
  { value: "mft", labelKey: "Micro Four Thirds" },
  // Film
  { value: "8mm", labelKey: "8mm" },
  { value: "super8", labelKey: "Super 8" },
  { value: "16mm", labelKey: "16mm" },
  { value: "super16", labelKey: "Super 16" },
  { value: "35mm", labelKey: "35mm" },
  { value: "65mm", labelKey: "65mm" },
  { value: "imax70", labelKey: "IMAX 70mm" },
  // Anamorphic
  { value: "anamorphic_ff", labelKey: "rental.dyn.cov.anaFF" },
  { value: "anamorphic_s35", labelKey: "rental.dyn.cov.anaS35" },
];

export const LENS_TYPES: FilterOption[] = [
  { value: "zoom", labelKey: "rental.dyn.lens.zoom" },
  { value: "prime", labelKey: "rental.dyn.lens.prime" },
  { value: "anamorphic", labelKey: "rental.dyn.lens.anamorphic" },
  { value: "vintage", labelKey: "rental.dyn.lens.vintage" },
];

export const LIGHTING_TYPES: FilterOption[] = [
  { value: "hmi", labelKey: "HMI" },
  { value: "led", labelKey: "LED" },
  { value: "tungsten", labelKey: "rental.dyn.light.tungsten" },
  { value: "tubes", labelKey: "rental.dyn.light.tubes" },
  { value: "fresnel", labelKey: "Fresnel" },
  { value: "panels", labelKey: "rental.dyn.light.panels" },
];

export const GRIP_TYPES: FilterOption[] = [
  { value: "tripods", labelKey: "rental.dyn.grip.tripods" },
  { value: "cstands", labelKey: "C-Stands" },
  { value: "dolly", labelKey: "Dolly" },
  { value: "slider", labelKey: "Slider" },
  { value: "gimbal", labelKey: "Gimbal" },
  { value: "rigging", labelKey: "rental.dyn.grip.rigging" },
];

export const ACCESSORY_TYPES: FilterOption[] = [
  { value: "follow_focus", labelKey: "Follow Focus" },
  { value: "matte_box", labelKey: "Matte Box" },
  { value: "monitor", labelKey: "rental.dyn.acc.monitor" },
  { value: "wireless_video", labelKey: "rental.dyn.acc.wirelessVideo" },
  { value: "batteries", labelKey: "rental.dyn.acc.batteries" },
  { value: "media", labelKey: "rental.dyn.acc.media" },
];

export const KIT_TYPES: FilterOption[] = [
  { value: "camera", labelKey: "rental.dyn.kit.camera" },
  { value: "lens", labelKey: "rental.dyn.kit.lens" },
  { value: "lighting", labelKey: "rental.dyn.kit.lighting" },
  { value: "production", labelKey: "rental.dyn.kit.production" },
];

// Per-category filter spec consumed by RentalHouse.
// kind: 'multi' (default) renders options as multi-select chips matching a text column;
//       'boolean' renders a single toggle chip matching a boolean column.
export type CategoryFilterSpec = {
  key: string;          // url param key
  column: string;       // db column
  labelKey: string;     // i18n label
  options: FilterOption[];
  multi: boolean;
  kind?: "multi" | "boolean";
};

export const CATEGORY_FILTERS: Record<string, CategoryFilterSpec[]> = {
  cameras: [
    { key: "brand", column: "brand", labelKey: "rental.dyn.brand", options: BRANDS, multi: true },
    { key: "sensor", column: "sensor_type", labelKey: "rental.dyn.sensorType", options: SENSOR_TYPES, multi: true },
    { key: "coverage", column: "coverage", labelKey: "rental.dyn.coverage", options: COVERAGE_FORMATS, multi: true },
    { key: "mount", column: "mount", labelKey: "rental.dyn.mountType", options: MOUNTS, multi: true },
  ],
  lenses: [
    { key: "brand", column: "brand", labelKey: "rental.dyn.brand", options: BRANDS, multi: true },
    { key: "lens_type", column: "lens_type", labelKey: "rental.dyn.lensType", options: LENS_TYPES, multi: true },
    { key: "mount", column: "mount", labelKey: "rental.dyn.mountType", options: MOUNTS, multi: true },
    { key: "coverage", column: "coverage", labelKey: "rental.dyn.coverage", options: COVERAGE_FORMATS, multi: true },
    { key: "anamorphic", column: "is_anamorphic", labelKey: "rental.dyn.anamorphic", options: [], multi: false, kind: "boolean" },
    { key: "vintage", column: "is_vintage", labelKey: "rental.dyn.vintage", options: [], multi: false, kind: "boolean" },
    { key: "rehoused", column: "is_rehoused", labelKey: "rental.dyn.rehoused", options: [], multi: false, kind: "boolean" },
  ],
  lighting: [
    { key: "lighting_type", column: "lighting_type", labelKey: "rental.dyn.lightingType", options: LIGHTING_TYPES, multi: true },
    { key: "brand", column: "brand", labelKey: "rental.dyn.brand", options: BRANDS, multi: true },
  ],
  grip: [
    { key: "grip_type", column: "grip_type", labelKey: "rental.dyn.gripType", options: GRIP_TYPES, multi: true },
  ],
  accessories: [
    { key: "accessory_type", column: "accessory_type", labelKey: "rental.dyn.accessoryType", options: ACCESSORY_TYPES, multi: true },
    { key: "brand", column: "brand", labelKey: "rental.dyn.brand", options: BRANDS, multi: true },
  ],
  kits: [
    { key: "kit_type", column: "kit_type", labelKey: "rental.dyn.kitType", options: KIT_TYPES, multi: true },
  ],
};

// Back-compat exports (kept so any existing imports don't break).
export const CAMERA_MOUNTS = MOUNTS;
export const LENS_MOUNTS = MOUNTS;
export const LENS_FORMATS = COVERAGE_FORMATS;
