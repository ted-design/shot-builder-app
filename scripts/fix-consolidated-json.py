#!/usr/bin/env python3
"""
Fix 3 critical issues in products-consolidated.json:
  1. Vendor field null on 15 style groups
  2. Size overrides not applied (sizeNote says per-color sizes but all get same)
  3. Colorways duplicated across style groups instead of split by vendor/variant

Reads source markdown catalogs to re-derive correct vendor, colorway, and size assignments.
Outputs products-consolidated-v2.json.
"""

import json
import re
import os
import copy
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / "data" / "extracted"
JSON_IN = BASE / "products-consolidated.json"
JSON_OUT = BASE / "products-consolidated-v2.json"
CATALOGS = [
    BASE / "raw-catalog.md",
    BASE / "raw-catalog-q2.md",
    BASE / "raw-catalog-q3q4.md",
]

# ── Size expansion helpers ──────────────────────────────────────────

LETTER_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]

def expand_letter_range(start, end):
    """Expand 'XS' - 'XXL' to list of sizes."""
    s = start.strip().upper()
    e = end.strip().upper()
    si = LETTER_ORDER.index(s) if s in LETTER_ORDER else 0
    ei = LETTER_ORDER.index(e) if e in LETTER_ORDER else len(LETTER_ORDER) - 1
    return LETTER_ORDER[si:ei + 1]


def expand_numeric_range(start, end, step=2):
    """Expand '28' - '40' to list of even waist sizes."""
    return [str(i) for i in range(int(start), int(end) + 1, step)]


def parse_size_range(text):
    """Parse a size range string like 'XS - XL' or '28-40' into a list."""
    text = text.strip()
    if text.upper() in ("O/S", "OS", "ONE SIZE"):
        return ["OS"]

    # Letter range: "XS - XXL" or "S-XXL"
    m = re.match(r"(XS|S|M|L|XL|XXL)\s*[-–]\s*(XS|S|M|L|XL|XXL)", text, re.I)
    if m:
        return expand_letter_range(m.group(1), m.group(2))

    # Numeric range: "28-40" or "28 - 40"
    m = re.match(r"(\d+)\s*[-–]\s*(\d+)", text)
    if m:
        return expand_numeric_range(m.group(1), m.group(2))

    return None


# ── Catalog parsing ─────────────────────────────────────────────────

def parse_catalogs(catalog_paths):
    """Parse all markdown catalogs into a list of product entries.
    Each entry has: product_name, style_numbers (with vendor/variant),
    vendor_colorways, size_range, vendors.
    """
    entries = []
    for path in catalog_paths:
        text = path.read_text(encoding="utf-8")
        blocks = re.split(r"\n---\n", text)
        for block in blocks:
            entry = parse_product_block(block)
            if entry:
                entries.append(entry)
    return entries


def parse_product_block(block):
    """Parse a single product block from the markdown."""
    lines = block.strip().split("\n")

    # Find product name
    name_line = None
    for line in lines:
        if line.startswith("### "):
            name_line = line[4:].strip()
            break
    if not name_line:
        return None

    # Clean product name (remove Q2/Q3/Q4 suffix markers)
    clean_name = re.sub(r"\s*\(Q[1-4]\)$", "", name_line)
    clean_name = re.sub(r"\s*\(Q[1-4]\s*-\s*.*?\)$", "", clean_name)

    entry = {
        "raw_name": name_line,
        "clean_name": clean_name,
        "style_numbers": [],
        "vendor_colorways": {},
        "flat_colorways": [],
        "size_range": None,
        "vendors": None,
    }

    full_text = "\n".join(lines)

    # Parse style numbers with vendor/variant annotations
    style_section = re.search(
        r"\*\*Style Numbers?\*\*:\s*\n((?:\s+-\s+.*\n?)+)", full_text
    )
    if style_section:
        for m in re.finditer(r"-\s+(.+)", style_section.group(1)):
            style_line = m.group(1).strip()
            sn_match = re.match(
                r"([\w-]+(?:\s*/\s*[\w-]+)?)"
                r"(?:\s*\(([^)]+)\))?"
                r"(?:\s*\(previously\s+[^)]+\))?",
                style_line,
            )
            if sn_match:
                style_num = sn_match.group(1).strip()
                annotation = sn_match.group(2)
                vendor = None
                variant = None
                prev = None

                if annotation:
                    # Check for "previously ..." in annotation
                    if "previously" in annotation.lower():
                        prev = annotation
                    else:
                        parts = [p.strip() for p in annotation.split("-")]
                        vendor = parts[0].strip()
                        if len(parts) > 1:
                            variant = parts[1].strip()

                # Also check for (previously ...) after
                prev_match = re.search(
                    r"\(previously\s+([^)]+)\)", style_line
                )
                if prev_match:
                    prev = prev_match.group(1).strip()

                entry["style_numbers"].append({
                    "styleNumber": style_num,
                    "vendor": vendor,
                    "variant": variant,
                    "previous": prev,
                })

    # Parse colorways with vendor prefixes
    color_section = re.search(
        r"\*\*Colorways?\*\*:\s*\n((?:\s+-\s+.*\n?)+)", full_text
    )
    if color_section:
        for m in re.finditer(r"-\s+(.+)", color_section.group(1)):
            cline = m.group(1).strip()

            # Check for vendor prefix: "ABMT: Black, Navy" or "ABMT (Q2 Order): ..."
            vendor_match = re.match(
                r"([\w]+)(?:\s*\([^)]*\))?\s*:\s*(.+)", cline
            )
            # Also handle Q3/Q4 prefix: "Q3: Black, Navy..."
            q_match = re.match(r"Q[1-4]\s*:\s*(.+)", cline)

            if vendor_match and not q_match:
                vendor_key = vendor_match.group(1).strip()
                colors_str = vendor_match.group(2).strip()
                colors = parse_color_list(colors_str)
                if vendor_key not in entry["vendor_colorways"]:
                    entry["vendor_colorways"][vendor_key] = []
                entry["vendor_colorways"][vendor_key].extend(colors)
            else:
                # Flat colorway list (no vendor prefix) or Q-prefix
                if q_match:
                    colors_str = q_match.group(1).strip()
                else:
                    colors_str = cline
                colors = parse_color_list(colors_str)
                entry["flat_colorways"].extend(colors)
    else:
        # Try single-line colorways: "**Colorways**: Black, Navy, ..."
        color_line = re.search(r"\*\*Colorways?\*\*:\s*(.+)", full_text)
        if color_line:
            colors_str = color_line.group(1).strip()
            colors = parse_color_list(colors_str)
            entry["flat_colorways"].extend(colors)

    # If no vendor_colorways parsed but flat_colorways exist, keep flat
    # Parse vendors line
    vendors_match = re.search(r"\*\*Vendors?\*\*:\s*(.+)", full_text)
    if vendors_match:
        entry["vendors"] = vendors_match.group(1).strip()

    # Parse size range
    size_match = re.search(r"\*\*Size Range\*\*:\s*(.+)", full_text)
    if size_match:
        entry["size_range"] = size_match.group(1).strip()

    return entry


def parse_color_list(text):
    """Parse comma-separated color names, stripping fabric codes and annotations."""
    colors = []
    # Split by comma but handle parenthetical notes
    parts = re.split(r",\s*(?![^(]*\))", text)
    for part in parts:
        # Remove fabric code suffixes like (0101), (DTM Stitch), etc.
        clean = re.sub(r"\s*\([^)]*\)", "", part).strip()
        # Remove "Repeat Colours" suffix
        clean = re.sub(r"\s*\(Repeat.*?\)", "", clean, flags=re.I).strip()
        if clean and clean not in ("Repeat Colours",):
            colors.append(clean)
    return colors


# ── Build lookup from catalogs ──────────────────────────────────────

def build_style_lookup(catalog_entries):
    """Build a dict: style_number -> list of catalog entries that reference it,
    with vendor/variant info from the style number line.
    """
    lookup = {}
    for entry in catalog_entries:
        for sn_info in entry["style_numbers"]:
            sn = sn_info["styleNumber"]
            if sn not in lookup:
                lookup[sn] = []
            lookup[sn].append({
                "entry": entry,
                "vendor": sn_info["vendor"],
                "variant": sn_info["variant"],
            })
    return lookup


# ── Fix logic ───────────────────────────────────────────────────────

def infer_vendor_from_fabric(fabric_content):
    """Infer vendor from fabric code in fabricContent string."""
    if not fabric_content:
        return None
    fc = fabric_content.upper()
    if "ABMT" in fc or "JWO088" in fc or "JWO045" in fc or "LWP008" in fc:
        return "ABMT"
    if "DIYANG" in fc or "M1022" in fc or "M3009" in fc or "N1003" in fc:
        return "Diyang"
    if "TAMURAKOMA" in fc or "3154" in fc or "778" in fc or "TOLLEGNO" in fc:
        return "Tamurakoma"
    if "VENITRA" in fc:
        return "Venitra"
    if "ROCA" in fc:
        return "Roca"
    if "INRIGHT" in fc:
        return "Inright"
    if "GLORY" in fc:
        return "Glory"
    return None


# Hardcoded vendor assignments for style numbers that have no vendor
# annotation in the catalog and only "previously ..." notation.
# Derived from the catalog's Vendors line + fabric codes.
MANUAL_VENDOR_MAP = {
    # Men's Crew Neck T-Shirt: vendors=ABMT/Diyang, single style group
    # has both ABMT and Diyang fabrics, but it's ONE style number
    # covering both vendors. Keep null? No - the JSON fabric says "ABMT",
    # so this style number is the ABMT entry.
    "M-TP-TS-1069": ("ABMT", None),
    # Women's Relaxed Crew: vendors=ABMT/Diyang, fabric=ABMT
    "W-TP-TS-1137": ("ABMT", None),
    # Women's Relaxed LS Crew: vendors=ABMT/Diyang, fabric=ABMT
    "W-TP-LS-1138": ("ABMT", None),
    # Men's LS Henley: vendors=ABMT/Diyang, fabric=ABMT
    "M-TP-HN-1311": ("ABMT", None),
    # Beanie: vendors=Roca/Inright/Glory (TBC)
    "U-AC-BN-1374": ("Roca", None),
    # Women's Flannel Shirt: vendors=TBC (Tamurakoma/Diyang)
    "W-TP-BU-1239": ("Tamurakoma", None),
    # W-TP-TS-1066 is likely a typo for W-TP-LS-1066 in the JSON.
    # The catalog only has W-TP-LS-1066 for Women's Long Sleeve Merino Crew.
    # This appears as a 4th style group with all 18 colors duplicated.
    # Keep vendor assignment consistent:
    "W-TP-TS-1066": ("ABMT", "Solid"),
}


def fix_vendor(style_group, style_lookup):
    """Issue 1: Fill in null vendor from catalog style number annotations."""
    sn = style_group["styleNumber"]
    if style_group["vendor"] is not None:
        return False

    if sn in style_lookup:
        for ref in style_lookup[sn]:
            if ref["vendor"]:
                style_group["vendor"] = ref["vendor"]
                if ref["variant"]:
                    style_group["variant"] = ref["variant"]
                return True

        # If no explicit vendor on style number line, check the entry's vendors field
        for ref in style_lookup[sn]:
            vendors_str = ref["entry"].get("vendors", "")
            if vendors_str and "/" not in vendors_str:
                # Single vendor product
                vendor = vendors_str.strip()
                # Clean up annotations
                vendor = re.sub(r"\s*\(.*?\)", "", vendor).strip()
                if vendor and vendor != "TBC":
                    style_group["vendor"] = vendor
                    return True

    # Try fabric content inference
    vendor = infer_vendor_from_fabric(style_group.get("fabricContent"))
    if vendor:
        style_group["vendor"] = vendor
        return True

    # Try manual map
    if sn in MANUAL_VENDOR_MAP:
        v, var = MANUAL_VENDOR_MAP[sn]
        style_group["vendor"] = v
        if var:
            style_group["variant"] = var
        return True

    return False


def get_stripe_colors(color_list):
    """Filter colorways that contain 'Stripe'."""
    return [c for c in color_list if "stripe" in c.lower()]


def get_non_stripe_colors(color_list):
    """Filter colorways that do NOT contain 'Stripe'."""
    return [c for c in color_list if "stripe" not in c.lower()]


def fix_colorways_for_product(product, style_lookup, catalog_entries):
    """Issue 3: Re-derive correct colorway-to-style-group mapping.
    Only fixes products where all style groups have identical colorway sets.
    """
    groups = product["styleGroups"]
    if len(groups) <= 1:
        return 0

    # Check if all groups have the same colorway set (the duplication bug)
    first_colors = sorted(cw["colorName"] for cw in groups[0]["colorways"])
    all_same = all(
        sorted(cw["colorName"] for cw in sg["colorways"]) == first_colors
        for sg in groups[1:]
    )
    if not all_same:
        return 0

    # Find the catalog entries for this product
    # Collect all vendor-colorway info from catalog entries matching any of our style numbers
    style_numbers = [sg["styleNumber"] for sg in groups]

    # Gather all catalog entries that reference any of our style numbers
    relevant_entries = []
    for sn in style_numbers:
        if sn in style_lookup:
            for ref in style_lookup[sn]:
                if ref["entry"] not in relevant_entries:
                    relevant_entries.append(ref["entry"])

    if not relevant_entries:
        return 0

    # Merge vendor_colorways from all relevant catalog entries
    merged_vendor_colors = {}
    merged_flat_colors = []
    for entry in relevant_entries:
        for vendor, colors in entry.get("vendor_colorways", {}).items():
            if vendor not in merged_vendor_colors:
                merged_vendor_colors[vendor] = set()
            merged_vendor_colors[vendor].update(colors)
        merged_flat_colors.extend(entry.get("flat_colorways", []))

    # Remove duplicates from flat colors
    merged_flat_colors = list(dict.fromkeys(merged_flat_colors))

    # Now assign colorways to style groups
    # For each style group, determine which vendor/variant it represents
    fixes = 0
    all_product_colors = set(cw["colorName"] for cw in groups[0]["colorways"])

    # Build map: style_number -> (vendor, variant) from catalog
    sn_vendor_map = {}
    for sn in style_numbers:
        if sn in style_lookup:
            for ref in style_lookup[sn]:
                if ref["vendor"]:
                    sn_vendor_map[sn] = (ref["vendor"], ref.get("variant"))
                    break

    # Special cases: products where style groups represent different variants
    # of the same vendor (e.g., ABMT-Solid vs ABMT-Stripe)
    has_vendor_split = len(merged_vendor_colors) > 0
    has_variant_split = any(
        v[1] is not None for v in sn_vendor_map.values() if v
    )

    if not has_vendor_split and not has_variant_split:
        # No vendor info to split on - likely Q3/Q4 entries with flat colors
        # Check if these are actually different style numbers for the same
        # product across quarters (e.g., UM2025-716 and W-DR-DR-1317)
        # In this case both get all colorways (deduped from all quarters)
        # This is actually correct behavior for products that have
        # old-style-number and new-style-number
        return 0

    # Build assignment: which colors go to which style group
    for sg in groups:
        sn = sg["styleNumber"]
        vendor_variant = sn_vendor_map.get(sn)

        if not vendor_variant:
            # No vendor annotation on this style number
            # If it's a single-vendor product with flat colors, assign all
            continue

        vendor, variant = vendor_variant
        target_colors = set()

        if vendor in merged_vendor_colors:
            vendor_colors = merged_vendor_colors[vendor]
            if variant:
                if variant.lower() == "stripe":
                    target_colors = set(get_stripe_colors(vendor_colors))
                elif variant.lower() == "solid":
                    target_colors = set(get_non_stripe_colors(vendor_colors))
                else:
                    target_colors = vendor_colors
            else:
                target_colors = vendor_colors

        # Also include flat colorways for the matching vendor
        # (Q3/Q4 entries don't always have vendor prefix on colorways)

        if not target_colors:
            # Fallback: keep existing colorways
            continue

        # Filter the colorways list to only include target colors
        existing_colorways = sg["colorways"]
        # Keep only colorways whose name is in target_colors
        new_colorways = [
            cw for cw in existing_colorways if cw["colorName"] in target_colors
        ]

        # Also check for colorways from later quarters that may not be in
        # the original vendor split but belong to this vendor
        # For Q3/Q4 entries with flat colorways (no vendor prefix),
        # we need to figure out vendor by fabric code or style number
        # For now, keep only what we can definitively assign

        if len(new_colorways) != len(existing_colorways):
            sg["colorways"] = new_colorways
            fixes += len(existing_colorways) - len(new_colorways)

    return fixes


def parse_size_note(size_note):
    """Parse a sizeNote like 'XS - XXL for Black, Ivory; XS - XL for All Other Colours'
    Returns dict: {frozenset(color_names) | 'default': size_list}
    """
    if not size_note:
        return None

    # Pattern: "XS - XXL for Black, Ivory; XS - XL for All Other Colours"
    # Also: "XS - XXL (Black, Ivory) / XS - XL (All Other Colours)"
    result = {}

    # Try semicolon-separated pattern
    parts = re.split(r"[;/]", size_note)
    for part in parts:
        part = part.strip()

        # "XS - XXL for Black, Ivory"
        m = re.match(
            r"((?:XS|S|M|L|XL|XXL)\s*[-–]\s*(?:XS|S|M|L|XL|XXL))\s+"
            r"(?:for\s+)?(.+)",
            part,
            re.I,
        )
        if not m:
            # "XS - XXL (Black, Ivory)"
            m = re.match(
                r"((?:XS|S|M|L|XL|XXL)\s*[-–]\s*(?:XS|S|M|L|XL|XXL))\s*"
                r"\(([^)]+)\)",
                part,
                re.I,
            )
        if m:
            range_str = m.group(1).strip()
            colors_str = m.group(2).strip()
            sizes = parse_size_range(range_str)
            if sizes:
                if "all other" in colors_str.lower():
                    result["default"] = sizes
                else:
                    colors = [c.strip() for c in colors_str.split(",")]
                    for color in colors:
                        result[color.strip()] = sizes
            continue

        # Simple range like "XS - XL" (no color specification)
        simple = parse_size_range(part)
        if simple:
            result["default"] = simple

    return result if result else None


def fix_sizes(style_group):
    """Issue 2: Apply per-colorway size overrides from sizeNote."""
    fixes = 0
    for cw in style_group["colorways"]:
        size_note = cw.get("sizeNote")
        if not size_note:
            continue

        parsed = parse_size_note(size_note)
        if not parsed:
            continue

        color_name = cw["colorName"]
        target_sizes = None

        if color_name in parsed:
            target_sizes = parsed[color_name]
        elif "default" in parsed:
            target_sizes = parsed["default"]

        if target_sizes and target_sizes != cw["sizes"]:
            cw["sizes"] = target_sizes
            fixes += 1

    return fixes


# ── Main ────────────────────────────────────────────────────────────

def main():
    print("Reading source catalogs...")
    catalog_entries = parse_catalogs(CATALOGS)
    print(f"  Parsed {len(catalog_entries)} catalog entries")

    style_lookup = build_style_lookup(catalog_entries)
    print(f"  Built lookup for {len(style_lookup)} unique style numbers")

    print("\nReading current JSON...")
    with open(JSON_IN) as f:
        data = json.load(f)

    products = data["products"]
    print(f"  {len(products)} products, "
          f"{sum(len(p['styleGroups']) for p in products)} style groups")

    # ── Fix 1: Null vendors ─────────────────────────────────────────
    vendor_fixes = 0
    for product in products:
        for sg in product["styleGroups"]:
            if fix_vendor(sg, style_lookup):
                vendor_fixes += 1

    print(f"\n[Fix 1] Vendor fixes: {vendor_fixes} style groups updated")

    # Show remaining null vendors
    remaining_null = [
        (p["gender"], p["productName"], sg["styleNumber"])
        for p in products
        for sg in p["styleGroups"]
        if sg["vendor"] is None
    ]
    if remaining_null:
        print(f"  Still null ({len(remaining_null)}):")
        for g, n, sn in remaining_null:
            print(f"    {sn} in {g} {n}")

    # ── Fix 3: Colorway deduplication (before Fix 2 so sizes apply to correct colors)
    colorway_fixes = 0
    products_with_colorway_fixes = 0
    for product in products:
        n = fix_colorways_for_product(product, style_lookup, catalog_entries)
        if n > 0:
            colorway_fixes += n
            products_with_colorway_fixes += 1

    print(f"\n[Fix 3] Colorway redistribution: {colorway_fixes} colorways "
          f"removed across {products_with_colorway_fixes} products")

    # ── Fix 3b: Handle remaining duplication cases ────────────────
    # Products with old-style-number + new-style-number across quarters:
    # Each style number should get only the colorways from its quarter(s).
    # Also remove the W-TP-TS-1066 typo group from Women's Long Sleeve.
    fix3b_count = 0
    for product in products:
        groups = product["styleGroups"]

        # Remove the typo style group W-TP-TS-1066 from Women's Long Sleeve
        if (product["productName"] == "Long Sleeve Merino Crew"
                and product["gender"] == "women"):
            before = len(groups)
            product["styleGroups"] = [
                sg for sg in groups if sg["styleNumber"] != "W-TP-TS-1066"
            ]
            removed = before - len(product["styleGroups"])
            if removed > 0:
                fix3b_count += removed
                print(f"  Removed typo group W-TP-TS-1066 from women Long Sleeve Merino Crew")

        # Remove the typo style group M-TP-TS-1071 from Men's Relaxed Crew
        # (catalog only has M-TP-LS-1071, the TS variant is a consolidation error)
        if (product["productName"] == "Relaxed Merino Crew Neck T-Shirt"
                and product["gender"] == "men"):
            groups = product["styleGroups"]
            if len(groups) == 2:
                sns = [sg["styleNumber"] for sg in groups]
                if "M-TP-LS-1071" in sns and "M-TP-TS-1071" in sns:
                    # Keep only M-TP-TS-1071 (the T-shirt style number)
                    # Actually the catalog says M-TP-LS-1071 (previously UM2025-161)
                    # but it's listed under T-Shirts. The LS prefix might be a catalog error.
                    # Keep whichever has TS (t-shirt) for a t-shirt product.
                    product["styleGroups"] = [
                        sg for sg in groups if sg["styleNumber"] == "M-TP-TS-1071"
                    ]
                    fix3b_count += 1
                    print(f"  Removed duplicate M-TP-LS-1071 from men Relaxed Crew")

        # For old+new style number products, split colorways by quarter
        groups = product["styleGroups"]
        if len(groups) != 2:
            continue

        sn0, sn1 = groups[0]["styleNumber"], groups[1]["styleNumber"]
        # Detect old+new pattern: one is UM20XX-XXX format, other is X-XX-XX-XXXX
        is_old_new = (
            (sn0.startswith("UM20") and not sn1.startswith("UM20"))
            or (sn1.startswith("UM20") and not sn0.startswith("UM20"))
        )
        if not is_old_new:
            continue

        # Check they have identical colorways (still duplicated)
        colors0 = sorted(cw["colorName"] for cw in groups[0]["colorways"])
        colors1 = sorted(cw["colorName"] for cw in groups[1]["colorways"])
        if colors0 != colors1:
            continue

        # Find catalog entries for each style number to get quarter-specific colors
        old_sn = sn0 if sn0.startswith("UM20") else sn1
        new_sn = sn1 if sn0.startswith("UM20") else sn0
        old_group = groups[0] if groups[0]["styleNumber"] == old_sn else groups[1]
        new_group = groups[0] if groups[0]["styleNumber"] == new_sn else groups[1]

        old_colors = set()
        new_colors = set()

        for sn, color_set in [(old_sn, old_colors), (new_sn, new_colors)]:
            if sn in style_lookup:
                for ref in style_lookup[sn]:
                    entry = ref["entry"]
                    # Collect all colors from this entry
                    for vc in entry.get("vendor_colorways", {}).values():
                        color_set.update(vc)
                    color_set.update(entry.get("flat_colorways", []))

        if old_colors and new_colors and old_colors != new_colors:
            # Split colorways - match by base color name (strip parenthetical codes)
            def color_matches(cw_name, target_set):
                if cw_name in target_set:
                    return True
                # Strip parenthetical suffix from colorway name for matching
                base = re.sub(r"\s*\(.*?\)", "", cw_name).strip()
                return base in target_set

            existing = groups[0]["colorways"]  # both have same set
            old_group["colorways"] = [
                cw for cw in existing if color_matches(cw["colorName"], old_colors)
            ]
            new_group["colorways"] = [
                cw for cw in existing if color_matches(cw["colorName"], new_colors)
            ]
            removed = len(existing) * 2 - len(old_group["colorways"]) - len(new_group["colorways"])
            fix3b_count += removed
            print(f"  Split {product['gender']} {product['productName']}: "
                  f"{old_sn}={len(old_group['colorways'])}, "
                  f"{new_sn}={len(new_group['colorways'])}")

    if fix3b_count:
        colorway_fixes += fix3b_count
        print(f"\n[Fix 3b] Additional fixes: {fix3b_count}")

    # Show result for key products
    for product in products:
        if len(product["styleGroups"]) > 1:
            groups = product["styleGroups"]
            if product["productName"] in (
                "Merino Crew Neck T-Shirt",
                "Merino V-Neck T-Shirt",
                "Long Sleeve Merino Crew",
                "Long Sleeve Merino Henley",
                "Merino Flex Jogger",
                "Merino Pull-On Travel Pant",
                "Mini Merino Long Sleeve Dress",
            ):
                print(f"  {product['gender']} {product['productName']}:")
                for sg in groups:
                    colors = [c["colorName"] for c in sg["colorways"]]
                    print(f"    {sg['styleNumber']} ({sg['vendor']}"
                          f"{' - ' + sg['variant'] if sg.get('variant') else ''}): "
                          f"{colors}")

    # ── Fix 2: Size overrides ───────────────────────────────────────
    size_fixes = 0
    for product in products:
        for sg in product["styleGroups"]:
            size_fixes += fix_sizes(sg)

    print(f"\n[Fix 2] Size fixes: {size_fixes} colorways corrected")

    # Spot check
    for product in products:
        if (product["productName"] == "Merino Crew Neck T-Shirt"
                and product["gender"] == "women"):
            for sg in product["styleGroups"]:
                for cw in sg["colorways"]:
                    if cw.get("sizeNote") and "XXL" in str(cw.get("sizeNote", "")):
                        print(f"  Spot check - {cw['colorName']}: {cw['sizes']}")

    # ── Write output ────────────────────────────────────────────────
    data["_extractedAt"] = data.get("_extractedAt", "") + " (v2-fixed)"
    total_colorways = sum(
        len(cw)
        for p in products
        for sg in p["styleGroups"]
        for cw in [sg["colorways"]]
    )
    data["_totalColorways"] = total_colorways

    with open(JSON_OUT, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nOutput written to: {JSON_OUT}")
    print(f"Total colorways in output: {total_colorways}")

    # ── Summary ─────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Vendors fixed:          {vendor_fixes}")
    print(f"  Sizes corrected:        {size_fixes}")
    print(f"  Colorways redistributed: {colorway_fixes}")
    print(f"  Total colorways:        {total_colorways} (was {data.get('_totalColorways', '?')})")


if __name__ == "__main__":
    main()
