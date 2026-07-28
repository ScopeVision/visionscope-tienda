// Label dictionaries: maps database value → display label.
// These are NOT filter option lists — options are computed dynamically from live data.
// Do not rename keys; they must match database values.

export const BRAND_LABELS: Record<string, string> = {
  arri: "ARRI",
  red: "RED",
  sony: "Sony",
  blackmagic: "Blackmagic",
  canon: "Canon",
  panasonic: "Panasonic",
  zeiss: "Zeiss",
  cooke: "Cooke",
  angenieux: "Angénieux",
  leica: "Leica",
  nikon: "Nikon",
  sigma: "Sigma",
  tokina: "Tokina",
  schneider: "Schneider",
  laowa: "Laowa",
  dzofilm: "DZOFilm",
  atlas: "Atlas",
  tribe7: "Tribe7",
  vantage: "Vantage",
  panavision: "Panavision",
};

export const SENSOR_TYPE_LABELS: Record<string, string> = {
  fullframe: "rental.dyn.sensor.fullframe",
  super35: "rental.dyn.sensor.super35",
  large_format: "rental.dyn.sensor.largeformat",
};

export const MOUNT_LABELS: Record<string, string> = {
  arri_pl: "ARRI PL",
  arri_lpl: "ARRI LPL",
  arri_standard: "ARRI Standard",
  arri_bayonet: "ARRI Bayonet",
  canon_ef: "Canon EF",
  canon_rf: "Canon RF",
  canon_fd: "Canon FD",
  sony_e: "Sony E",
  nikon_f: "Nikon F",
  nikon_z: "Nikon Z",
  leica_m: "Leica M",
  leica_r: "Leica R",
  leica_l: "Leica L",
  panavision_pv: "Panavision PV",
  b4: "B4",
  c_mount: "C-Mount",
  oct19: "OCT-19",
  m42: "M42",
  mft: "Micro Four Thirds",
  l39: "L39 / LTM",
};

export const COVERAGE_LABELS: Record<string, string> = {
  fullframe: "rental.dyn.cov.fullframe",
  super35: "rental.dyn.cov.super35",
  apsc: "APS-C",
  vistavision: "VistaVision",
  large_format: "rental.dyn.cov.largeformat",
  mft: "Micro Four Thirds",
  "8mm": "8mm",
  super8: "Super 8",
  "16mm": "16mm",
  super16: "Super 16",
  "35mm": "35mm",
  "65mm": "65mm",
  imax70: "IMAX 70mm",
  anamorphic_ff: "rental.dyn.cov.anaFF",
  anamorphic_s35: "rental.dyn.cov.anaS35",
};

export const LENS_TYPE_LABELS: Record<string, string> = {
  zoom: "rental.dyn.lens.zoom",
  prime: "rental.dyn.lens.prime",
  anamorphic: "rental.dyn.lens.anamorphic",
  vintage: "rental.dyn.lens.vintage",
};

export const LIGHTING_TYPE_LABELS: Record<string, string> = {
  hmi: "HMI",
  led: "LED",
  tungsten: "rental.dyn.light.tungsten",
  tubes: "rental.dyn.light.tubes",
  fresnel: "Fresnel",
  panels: "rental.dyn.light.panels",
};

export const GRIP_TYPE_LABELS: Record<string, string> = {
  tripods: "rental.dyn.grip.tripods",
  cstands: "C-Stands",
  dolly: "Dolly",
  slider: "Slider",
  gimbal: "Gimbal",
  rigging: "rental.dyn.grip.rigging",
};

export const ACCESSORY_TYPE_LABELS: Record<string, string> = {
  follow_focus: "Follow Focus",
  matte_box: "Matte Box",
  monitor: "rental.dyn.acc.monitor",
  wireless_video: "rental.dyn.acc.wirelessVideo",
  batteries: "rental.dyn.acc.batteries",
  media: "rental.dyn.acc.media",
};

/** Returns the label key for a value, or the raw value if not found. */
export function getLabelKey(labelMap: Record<string, string>, value: string): string {
  return labelMap[value] ?? value;
}

export type FilterOption = { value: string; labelKey: string };

export type CategoryFilterSpec = {
  key: string;
  column: string;
  labelKey: string;
  labelMap?: Record<string, string>;
  options: FilterOption[];  // always [] — options come from dynamic facets
  multi: boolean;
  kind?: "multi" | "boolean";
};

// kits category removed — it does not exist in the database.
export const CATEGORY_FILTERS: Record<string, CategoryFilterSpec[]> = {
  cameras: [
    { key: "brand", column: "brand", labelKey: "rental.dyn.brand", labelMap: BRAND_LABELS, options: [], multi: true },
    { key: "sensor", column: "sensor_type", labelKey: "rental.dyn.sensorType", labelMap: SENSOR_TYPE_LABELS, options: [], multi: true },
    { key: "coverage", column: "coverage", labelKey: "rental.dyn.coverage", labelMap: COVERAGE_LABELS, options: [], multi: true },
    { key: "mount", column: "mount", labelKey: "rental.dyn.mountType", labelMap: MOUNT_LABELS, options: [], multi: true },
  ],
  lenses: [
    { key: "brand", column: "brand", labelKey: "rental.dyn.brand", labelMap: BRAND_LABELS, options: [], multi: true },
    { key: "lens_type", column: "lens_type", labelKey: "rental.dyn.lensType", labelMap: LENS_TYPE_LABELS, options: [], multi: true },
    { key: "mount", column: "mount", labelKey: "rental.dyn.mountType", labelMap: MOUNT_LABELS, options: [], multi: true },
    { key: "coverage", column: "coverage", labelKey: "rental.dyn.coverage", labelMap: COVERAGE_LABELS, options: [], multi: true },
    { key: "anamorphic", column: "is_anamorphic", labelKey: "rental.dyn.anamorphic", options: [], multi: false, kind: "boolean" },
    { key: "vintage", column: "is_vintage", labelKey: "rental.dyn.vintage", options: [], multi: false, kind: "boolean" },
    { key: "rehoused", column: "is_rehoused", labelKey: "rental.dyn.rehoused", options: [], multi: false, kind: "boolean" },
  ],
  lighting: [
    { key: "lighting_type", column: "lighting_type", labelKey: "rental.dyn.lightingType", labelMap: LIGHTING_TYPE_LABELS, options: [], multi: true },
    { key: "brand", column: "brand", labelKey: "rental.dyn.brand", labelMap: BRAND_LABELS, options: [], multi: true },
  ],
  grip: [
    { key: "grip_type", column: "grip_type", labelKey: "rental.dyn.gripType", labelMap: GRIP_TYPE_LABELS, options: [], multi: true },
  ],
  accessories: [
    { key: "accessory_type", column: "accessory_type", labelKey: "rental.dyn.accessoryType", labelMap: ACCESSORY_TYPE_LABELS, options: [], multi: true },
    { key: "brand", column: "brand", labelKey: "rental.dyn.brand", labelMap: BRAND_LABELS, options: [], multi: true },
  ],
};

// Back-compat exports so existing imports don't break.
function dictToOptions(d: Record<string, string>): FilterOption[] {
  return Object.entries(d).map(([value, labelKey]) => ({ value, labelKey }));
}
export const BRANDS = dictToOptions(BRAND_LABELS);
export const SENSOR_TYPES = dictToOptions(SENSOR_TYPE_LABELS);
export const MOUNTS = dictToOptions(MOUNT_LABELS);
export const COVERAGE_FORMATS = dictToOptions(COVERAGE_LABELS);
export const LENS_TYPES = dictToOptions(LENS_TYPE_LABELS);
export const LIGHTING_TYPES = dictToOptions(LIGHTING_TYPE_LABELS);
export const GRIP_TYPES = dictToOptions(GRIP_TYPE_LABELS);
export const ACCESSORY_TYPES = dictToOptions(ACCESSORY_TYPE_LABELS);
export const KIT_TYPES: FilterOption[] = [];
export const CAMERA_MOUNTS = MOUNTS;
export const LENS_MOUNTS = MOUNTS;
export const LENS_FORMATS = COVERAGE_FORMATS;
