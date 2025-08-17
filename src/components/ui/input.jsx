// src/components/ui/input.jsx
//
// A thin wrapper around <input> with consistent styles.

import React from "react";

const BaseInput = React.forwardRef(function Input(
  { className = "", ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={`border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      {...props}
    />
  );
});

export { BaseInput as Input };
