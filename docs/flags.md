# Flags

## VITE_FLAG_NEW_AUTH_CONTEXT
Default OFF. Enables new auth context + route guard.

### Override precedence
1. localStorage key `flag:VITE_FLAG_NEW_AUTH_CONTEXT`
2. URL `?auth=on|off`
3. .env value

### Dev notes
- Emit console.warn once when override is active (include source)
- Unit tests assert pass-through when OFF

