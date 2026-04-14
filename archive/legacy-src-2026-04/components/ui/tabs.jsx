/**
 * Tabs component - shadcn/ui Radix-based implementation
 *
 * Built on @radix-ui/react-tabs for proper accessibility:
 * - Full keyboard navigation (Arrow keys, Tab, Enter/Space)
 * - ARIA attributes managed automatically
 * - Focus management and roving tabindex
 *
 * API matches shadcn conventions for consistency with other ui components.
 */
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={[
      "inline-flex h-9 items-center justify-start gap-1 rounded-lg bg-slate-100 p-1 text-slate-500",
      "dark:bg-slate-800 dark:text-slate-400",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={[
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5",
      "text-sm font-medium transition-all",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm",
      "data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:text-slate-900",
      "dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-50",
      "dark:data-[state=inactive]:text-slate-400 dark:data-[state=inactive]:hover:text-slate-50",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={[
      "mt-2",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
