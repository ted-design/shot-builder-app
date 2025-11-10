# Brand Assets

This directory contains brand logos for Shot Builder's co-branding.

## Current Assets

### Immediate Logos
- ✅ `immediate-logo-black.png` - For light backgrounds
- ✅ `immediate-logo-white.png` - For dark backgrounds

### Unbound Merino Logos
- ⚠️ `unbound-logo-black.png` - **NEEDED**: Black wordmark for light backgrounds
- ⚠️ `unbound-logo-white.png` - **NEEDED**: White wordmark for dark backgrounds

## Usage

These logos are used by the `BrandLockup` component in the app header.

```jsx
import { BrandLockup } from '@/components/common/BrandLockup';

<BrandLockup size="md" />
```

## Logo Specifications

- **Format**: PNG with transparency
- **Height**: Logos will be scaled to 24px (mobile) or 32px (desktop)
- **Aspect Ratio**: Preserved (width auto)
- **Background**: Transparent

## Adding/Updating Logos

1. Export logos as PNG with transparent background
2. Ensure high resolution (2x or 3x for retina displays)
3. Name files following the pattern: `[brand]-logo-[color].png`
4. Update this README when adding new assets

## Notes

- The BrandLockup component automatically switches logos based on the current theme (light/dark mode)
- Logos should maintain their original aspect ratio
- Ensure sufficient contrast against both light and dark backgrounds
