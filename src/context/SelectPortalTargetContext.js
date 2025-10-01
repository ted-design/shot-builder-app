import { createContext, useContext, useMemo } from "react";

const SelectPortalTargetContext = createContext({ target: undefined, menuProps: undefined });

export function SelectPortalTargetProvider({ target, zIndex = 1300, children }) {
  const value = useMemo(() => {
    const resolvedTarget =
      target ?? (typeof window === "undefined" ? undefined : window.document.body);
    if (!resolvedTarget) {
      return { target: undefined, menuProps: undefined };
    }
    return {
      target: resolvedTarget,
      menuProps: {
        menuPortalTarget: resolvedTarget,
        menuShouldBlockScroll: true,
        styles: {
          menuPortal: (base) => ({ ...base, zIndex }),
        },
      },
    };
  }, [target, zIndex]);

  return (
    <SelectPortalTargetContext.Provider value={value}>
      {children}
    </SelectPortalTargetContext.Provider>
  );
}

export function useSelectPortalTarget() {
  const { target } = useContext(SelectPortalTargetContext);
  return target ?? (typeof window === "undefined" ? undefined : window.document.body);
}

export function useSelectMenuPortalProps() {
  const { menuProps } = useContext(SelectPortalTargetContext);
  if (menuProps) return menuProps;
  const fallbackTarget = typeof window === "undefined" ? undefined : window.document.body;
  if (!fallbackTarget) return undefined;
  return {
    menuPortalTarget: fallbackTarget,
    menuShouldBlockScroll: true,
    styles: {
      menuPortal: (base) => ({ ...base, zIndex: 1300 }),
    },
  };
}
