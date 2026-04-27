// Centralised definition of category-aware filter options for the rental catalog.
// These keys are persisted in the products table (brand, mount, sensor_type, ...).

export type FilterOption = { value: string; labelKey: string };

export const BRANDS: FilterOption[] = [
  { value: "arri", labelKey: "ARRI" },
  { value: "red", labelKey: "RED" },
  { value: "sony", labelKey: "Sony" },
  { value: "blackmagic", labelKey: "Blackmagic" },
  { value: "canon", labelKey: "Canon" },
  { value: "panasonic", labelKey: "Panasonic" },
];

export const SENSOR_TYPES: FilterOption[] = [
  { value: "fullframe", labelKey: "rental.dyn.sensor.fullframe" },
  { value: "super35", labelKey: "rental.dyn.sensor.super35" },
  { value: "large_format", labelKey: "rental.dyn.sensor.largeformat" },
];

export const CAMERA_MOUNTS: FilterOption[] = [
  { value: "pl", labelKey: "PL Mount" },
  { value: "ef", labelKey: "EF Mount" },
  { value: "rf", labelKey: "RF Mount" },
  { value: "e", labelKey: "E Mount" },
  { value: "l", labelKey: "L Mount" },
];

export const LENS_MOUNTS: FilterOption[] = [
  { value: "pl", labelKey: "PL" },
  { value: "ef", labelKey: "EF" },
  { value: "e", labelKey: "E Mount" },
  { value: "rf", labelKey: "RF Mount" },
];

export const LENS_TYPES: FilterOption[] = [
  { value: "zoom", labelKey: "rental.dyn.lens.zoom" },
  { value: "prime", labelKey: "rental.dyn.lens.prime" },
  { value: "anamorphic", labelKey: "rental.dyn.lens.anamorphic" },
  { value: "vintage", labelKey: "rental.dyn.lens.vintage" },
];

export const LENS_FORMATS: FilterOption[] = [
  { value: "fullframe", labelKey: "rental.dyn.sensor.fullframe" },
  { value: "super35", labelKey: "rental.dyn.sensor.super35" },
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
// `column` is the products table column. `multi` enables multi-select.
export type CategoryFilterSpec = {
  key: string;          // url param key
  column: string;       // db column
  labelKey: string;     // i18n label
  options: FilterOption[];
  multi: boolean;
};

export const CATEGORY_FILTERS: Record<string, CategoryFilterSpec[]> = {
  cameras: [
    { key: "brand", column: "brand", labelKey: "rental.dyn.brand", options: BRANDS, multi: true },
    { key: "sensor", column: "sensor_type", labelKey: "rental.dyn.sensorType", options: SENSOR_TYPES, multi: true },
    { key: "mount", column: "mount", labelKey: "rental.dyn.mountType", options: CAMERA_MOUNTS, multi: true },
  ],
  lenses: [
    { key: "lens_type", column: "lens_type", labelKey: "rental.dyn.lensType", options: LENS_TYPES, multi: true },
    { key: "mount", column: "mount", labelKey: "rental.dyn.mountType", options: LENS_MOUNTS, multi: true },
    { key: "format", column: "format", labelKey: "rental.dyn.format", options: LENS_FORMATS, multi: true },
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
