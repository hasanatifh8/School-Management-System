import { HOUSE_COLOR_KEYS, HOUSE_COLORS, houseColor } from "@/lib/houses";

/** Coloured pill with the house name. */
export function HouseBadge({ house }: { house: { name: string; color: string } }) {
  const c = houseColor(house.color);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${c.badge}`}
    >
      <span className={`h-2 w-2 rounded-full ${c.dot}`} />
      {house.name}
    </span>
  );
}

/** Radio swatches for choosing a house colour (works without JavaScript). */
export function HouseColorPicker({ defaultValue = "green" }: { defaultValue?: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-slate-700">
        Colour<span className="ml-0.5 text-rose-500">*</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {HOUSE_COLOR_KEYS.map((key) => (
          <label
            key={key}
            title={HOUSE_COLORS[key].label}
            className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full ring-offset-2 transition has-[:checked]:ring-2 has-[:checked]:ring-slate-900 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500"
          >
            <input
              type="radio"
              name="color"
              value={key}
              defaultChecked={key === defaultValue}
              className="sr-only"
            />
            <span className={`h-7 w-7 rounded-full ${HOUSE_COLORS[key].dot}`} />
            <span className="sr-only">{HOUSE_COLORS[key].label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
