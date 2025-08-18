// src/components/ui/input.jsx
//
// A thin wrapper around the native `<input>` element that applies a
// consistent border, padding and rounded corners.  Supports forwarding
// refs so that parent components can imperatively focus or measure the
// input.  Additional props (e.g. type, placeholder) are passed through.

import React from "react";

const BaseInput = ({ className = "", ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={
        `border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${className}`.trim()
      }
      {...props}
    />
  );
};

/**
 * Input component with forwarded ref.  Use this in place of a plain input
 * element to apply consistent styling across the application.  Accepts
 * all standard input props.
 */
export const Input = React.forwardRef(BaseInput);

Input.displayName = "Input";