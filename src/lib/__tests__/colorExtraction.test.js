/**
 * Tests for color extraction utilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeHexColor,
  isValidHexColor,
  getColorBrightness,
  extractColorFromFile,
  extractColorFromUrl,
  getSkuColor,
} from '../colorExtraction';

describe('normalizeHexColor', () => {
  it('should normalize lowercase hex to uppercase', () => {
    expect(normalizeHexColor('#abc123')).toBe('#ABC123');
  });

  it('should expand 3-digit hex to 6-digit', () => {
    expect(normalizeHexColor('#abc')).toBe('#AABBCC');
    expect(normalizeHexColor('#123')).toBe('#112233');
  });

  it('should convert rgb to hex', () => {
    expect(normalizeHexColor('rgb(255, 0, 0)')).toBe('#FF0000');
    expect(normalizeHexColor('rgb(0, 255, 0)')).toBe('#00FF00');
    expect(normalizeHexColor('rgba(0, 0, 255, 1)')).toBe('#0000FF');
  });

  it('should fallback to gray for invalid colors', () => {
    expect(normalizeHexColor('')).toBe('#CCCCCC');
    expect(normalizeHexColor(null)).toBe('#CCCCCC');
    expect(normalizeHexColor(undefined)).toBe('#CCCCCC');
    expect(normalizeHexColor('invalid')).toBe('#CCCCCC');
  });

  it('should handle already normalized colors', () => {
    expect(normalizeHexColor('#FF0000')).toBe('#FF0000');
    expect(normalizeHexColor('#ABCDEF')).toBe('#ABCDEF');
  });

  it('should trim whitespace', () => {
    expect(normalizeHexColor('  #abc123  ')).toBe('#ABC123');
  });
});

describe('isValidHexColor', () => {
  it('should validate correct hex colors', () => {
    expect(isValidHexColor('#FFFFFF')).toBe(true);
    expect(isValidHexColor('#000000')).toBe(true);
    expect(isValidHexColor('#abc123')).toBe(true);
    expect(isValidHexColor('#ABCDEF')).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(isValidHexColor('#fff')).toBe(false); // 3-digit not valid in strict mode
    expect(isValidHexColor('FFFFFF')).toBe(false); // Missing #
    expect(isValidHexColor('#GGGGGG')).toBe(false); // Invalid characters
    expect(isValidHexColor('#12345')).toBe(false); // Wrong length
    expect(isValidHexColor('#1234567')).toBe(false); // Wrong length
    expect(isValidHexColor('')).toBe(false);
    expect(isValidHexColor(null)).toBe(false);
    expect(isValidHexColor(undefined)).toBe(false);
  });

  it('should handle whitespace', () => {
    expect(isValidHexColor('  #FFFFFF  ')).toBe(true);
  });
});

describe('getColorBrightness', () => {
  it('should detect light colors', () => {
    expect(getColorBrightness('#FFFFFF')).toBe('light');
    expect(getColorBrightness('#FFFF00')).toBe('light'); // Yellow
    expect(getColorBrightness('#00FFFF')).toBe('light'); // Cyan
  });

  it('should detect dark colors', () => {
    expect(getColorBrightness('#000000')).toBe('dark');
    expect(getColorBrightness('#0000FF')).toBe('dark'); // Blue
    expect(getColorBrightness('#8B0000')).toBe('dark'); // Dark red
  });

  it('should handle mid-tone colors', () => {
    expect(getColorBrightness('#808080')).toBe('light'); // Gray (>0.5 threshold)
    expect(getColorBrightness('#696969')).toBe('dark'); // Dim gray
  });
});

describe('extractColorFromFile', () => {
  beforeEach(() => {
    // Clean up any previous mocks
    vi.restoreAllMocks();
  });

  it('should return null for invalid file type', async () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const result = await extractColorFromFile(file);
    expect(result).toBeNull();
  });

  it('should return null for null file', async () => {
    const result = await extractColorFromFile(null);
    expect(result).toBeNull();
  });

  // Note: Testing actual image extraction requires mocking FastAverageColor
  // and DOM APIs (Image, URL.createObjectURL, etc.) which is complex.
  // In a real scenario, you'd use a more sophisticated mocking strategy
  // or test this in an integration test with actual image files.
});

describe('extractColorFromUrl', () => {
  it('should return null for empty URL', async () => {
    const result = await extractColorFromUrl('');
    expect(result).toBeNull();
  });

  it('should return null for null URL', async () => {
    const result = await extractColorFromUrl(null);
    expect(result).toBeNull();
  });

  // Note: Testing actual image extraction requires mocking Image loading
  // which is better suited for integration tests
});

describe('getSkuColor', () => {
  it('should use hexColor if available', async () => {
    const sku = {
      hexColor: '#FF0000',
      imagePath: '/path/to/image.jpg',
    };

    const result = await getSkuColor(sku);
    expect(result).toBe('#FF0000');
  });

  it('should fallback to gray if no hexColor or imagePath', async () => {
    const sku = {};
    const result = await getSkuColor(sku);
    expect(result).toBe('#CCCCCC');
  });

  it('should fallback to gray if hexColor is invalid', async () => {
    const sku = {
      hexColor: 'invalid',
      imagePath: null,
    };

    const result = await getSkuColor(sku);
    expect(result).toBe('#CCCCCC');
  });

  // Testing the imagePath extraction would require mocking extractColorFromUrl
  // which depends on Image loading, better suited for integration tests
});
