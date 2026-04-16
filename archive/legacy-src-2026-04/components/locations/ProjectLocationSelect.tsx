import React, { useMemo } from "react";
import Select, { components } from "react-select";
import Avatar from "../ui/Avatar";
import Thumb from "../Thumb";

type LocationRecord = {
  id: string;
  name?: string | null;
  photoPath?: string | null;
  street?: string | null;
  unit?: string | null;
  city?: string | null;
  province?: string | null;
  postal?: string | null;
  address?: string | null;
};

const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: 40,
    borderRadius: 6,
    borderColor: state.isFocused ? "#2563eb" : "#cbd5f5",
    boxShadow: state.isFocused ? "0 0 0 1px rgba(37, 99, 235, 0.25)" : "none",
    "&:hover": {
      borderColor: state.isFocused ? "#2563eb" : "#94a3b8",
    },
  }),
  menuPortal: (base: any) => ({ ...base, zIndex: 1200 }),
};

function formatAddress(location: LocationRecord): string {
  const explicit = (location.address || "").trim();
  if (explicit) return explicit;
  const parts = [
    [location.street, location.unit].filter(Boolean).join(" ").trim(),
    [location.city, location.province].filter(Boolean).join(", ").trim(),
    location.postal,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return parts.join(" · ");
}

type Option = {
  value: string;
  label: string;
  address?: string;
  imagePath?: string | null;
  isCreate?: boolean;
  searchText?: string;
};

export default function ProjectLocationSelect({
  locations = [],
  value = "",
  onChange,
  onCreateNew,
  placeholder = "Select location",
  isDisabled = false,
}: {
  locations?: Array<LocationRecord>;
  value?: string;
  onChange?: (value: string) => void;
  onCreateNew?: () => void;
  placeholder?: string;
  isDisabled?: boolean;
}) {
  const selectOptions: Array<Option> = useMemo(() => {
    const base = (locations || []).map((loc) => {
      const name = (loc.name || "").trim() || "Untitled location";
      const address = formatAddress(loc);
      return {
        value: loc.id,
        label: name,
        address,
        imagePath: loc.photoPath || null,
        searchText: `${name} ${address}`.toLowerCase(),
      };
    });

    base.sort((a, b) => a.label.localeCompare(b.label));

    if (onCreateNew) {
      return [
        {
          value: "__create_location__",
          label: "Add location…",
          isCreate: true,
          searchText: "add location create new",
        },
        ...base,
      ];
    }

    return base;
  }, [locations, onCreateNew]);

  const selectedValue = useMemo(() => {
    if (!value) return null;
    const match = selectOptions.find((opt) => opt.value === value);
    return match || null;
  }, [selectOptions, value]);

  const OptionRow = (props: any) => {
    const { data } = props;
    if (data.isCreate) {
      return (
        <components.Option {...props}>
          <div className="flex items-center gap-2 text-blue-600">
            <span className="text-lg leading-none">+</span>
            <span className="font-medium">{data.label}</span>
          </div>
        </components.Option>
      );
    }

    const img = data.imagePath;
    return (
      <components.Option {...props}>
        <div className="flex items-center gap-2">
          {img ? (
            <div className="h-6 w-6 overflow-hidden rounded-md bg-slate-100">
              <Thumb
                path={img}
                size={96}
                alt={data.label}
                className="h-6 w-6"
                imageClassName="h-full w-full object-cover"
              />
            </div>
          ) : (
            <Avatar name={data.label} size="xs" />
          )}
          <div className="min-w-0">
            <div className="truncate">{data.label}</div>
            {data.address ? <div className="truncate text-xs text-slate-500">{data.address}</div> : null}
          </div>
        </div>
      </components.Option>
    );
  };

  const SingleValue = (props: any) => {
    const { data } = props;
    const img = data.imagePath;
    return (
      <components.SingleValue {...props}>
        <div className="flex items-center gap-2">
          {img ? (
            <div className="h-5 w-5 overflow-hidden rounded-md">
              <Thumb
                path={img}
                size={80}
                alt={data.label}
                className="h-5 w-5"
                imageClassName="h-full w-full object-cover"
              />
            </div>
          ) : (
            <Avatar name={data.label} size="xs" />
          )}
          <span className="truncate">{data.label}</span>
        </div>
      </components.SingleValue>
    );
  };

  const portalTarget = typeof window === "undefined" ? undefined : document.body;

  const handleChange = (next: any) => {
    if (!onChange) return;
    if (!next) return onChange("");
    if (next.value === "__create_location__") {
      onCreateNew?.();
      return;
    }
    onChange(next.value || "");
  };

  const filterOption = (candidate: any, input: string) => {
    const q = String(input || "").trim().toLowerCase();
    if (!q) return true;
    return String(candidate.data?.searchText || "").includes(q);
  };

  return (
    <Select
      isClearable
      classNamePrefix="project-location-select"
      styles={selectStyles}
      options={selectOptions}
      value={selectedValue}
      onChange={handleChange}
      isDisabled={isDisabled}
      placeholder={placeholder}
      menuPortalTarget={portalTarget}
      menuShouldBlockScroll
      filterOption={filterOption}
      components={{ Option: OptionRow, SingleValue }}
    />
  );
}

