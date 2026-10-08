/**
 * The business categories and workspace themes offered during onboarding.
 *
 * These are fixed lists on purpose. They are stored as short stable keys in
 * organization metadata, so a free-text field would make the stored value
 * unmatchable later — the picker and any future report both have to agree on the
 * same vocabulary.
 */

export const BUSINESS_TYPES = [
  { value: "retail", label: "Retail", hint: "Shops and market stalls" },
  { value: "wholesale", label: "Wholesale", hint: "Bulk supply and distribution" },
  { value: "services", label: "Services", hint: "Salons, studios, repairs" },
  { value: "food_and_beverage", label: "Food & beverage", hint: "Restaurants and bars" },
  { value: "construction", label: "Construction", hint: "Trades and building supplies" },
  { value: "transport", label: "Transport", hint: "Logistics and delivery" },
  { value: "agriculture", label: "Agriculture", hint: "Farming and produce" },
  { value: "other", label: "Something else", hint: "Tell us later in settings" },
] as const;

export const BUSINESS_THEMES = [
  { value: "violet", label: "Violet", hint: "The default" },
  { value: "emerald", label: "Emerald", hint: "Calm and green" },
  { value: "amber", label: "Amber", hint: "Warm and bright" },
  { value: "rose", label: "Rose", hint: "Soft and rose gold" },
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];
export type BusinessTheme = (typeof BUSINESS_THEMES)[number]["value"];

/** Staff bands, rather than an exact headcount nobody keeps up to date. */
export const EMPLOYEE_BANDS = [
  { value: "1", label: "Just me" },
  { value: "2-5", label: "2–5 people" },
  { value: "6-20", label: "6–20 people" },
  { value: "21-100", label: "21–100 people" },
  { value: "100+", label: "More than 100" },
] as const;

export type EmployeeBand = (typeof EMPLOYEE_BANDS)[number]["value"];
