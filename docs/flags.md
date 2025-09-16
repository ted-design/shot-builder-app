# Flags

## VITE_FLAG_NEW_AUTH_CONTEXT
Defaults to ON for production builds (off for local/dev unless explicitly set). Enables the new auth context + route guard.

### Override precedence
1. localStorage key `flag.newAuthContext`
2. URL `?auth=on|off|true|false|1|0|yes|no` or `?auth=clear`
3. .env value (`VITE_FLAG_NEW_AUTH_CONTEXT`)

### Dev notes
- Emit console.warn once when override is active (include source)
- Unit tests assert pass-through when OFF
