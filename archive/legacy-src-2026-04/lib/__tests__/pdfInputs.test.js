/**
 * Tests for pdfInputs — canonical PDF inputs helper
 *
 * Ensures that buildPdfInputs() produces consistent outputs for both
 * "Open PDF preview" and "Export PDF" handlers, and that the image
 * gate is solely dependent on options.fields.image.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildPdfInputs, stripLaneImages, logPdfInputs } from '../pdfInputs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeLanes(shotOverrides = []) {
  return [
    {
      id: 'lane-1',
      name: 'Lane A',
      shots: shotOverrides.length
        ? shotOverrides
        : [
            { id: 's1', name: 'Shot 1', image: 'https://img.test/1.jpg', productImages: ['https://img.test/prod1.jpg'] },
            { id: 's2', name: 'Shot 2', image: null, productImages: ['https://img.test/prod2.jpg'] },
            { id: 's3', name: 'Shot 3', image: 'https://img.test/3.jpg', productImages: [] },
          ],
    },
    {
      id: 'lane-2',
      name: 'Lane B',
      shots: [
        { id: 's4', name: 'Shot 4', image: null, productImages: [] },
      ],
    },
  ];
}

function makeOptions(overrides = {}) {
  return {
    title: 'Test Export',
    subtitle: '',
    orientation: 'portrait',
    layout: 'table',
    density: 'standard',
    fields: { image: true, shotNumber: true, name: true, type: true, date: true, location: true, talent: true, products: true, notes: true },
    includeLaneSummary: true,
    includeTalentSummary: true,
    includeImages: true,
    fallbackToProductImages: true,
    inlineImages: true,
    ...overrides,
    fields: { image: true, shotNumber: true, name: true, type: true, date: true, location: true, talent: true, products: true, notes: true, ...overrides.fields },
  };
}

const SUMMARY = { totalShots: 4, lanes: [] };
const TALENT = { rows: [], lanes: [] };

// ---------------------------------------------------------------------------
// stripLaneImages
// ---------------------------------------------------------------------------
describe('stripLaneImages', () => {
  it('sets all shot.image to null', () => {
    const lanes = makeLanes();
    const stripped = stripLaneImages(lanes);
    stripped.forEach((lane) => {
      lane.shots.forEach((shot) => {
        expect(shot.image).toBeNull();
      });
    });
  });

  it('preserves other shot properties', () => {
    const lanes = makeLanes();
    const stripped = stripLaneImages(lanes);
    expect(stripped[0].shots[0].id).toBe('s1');
    expect(stripped[0].shots[0].name).toBe('Shot 1');
  });

  it('does not mutate original lanes', () => {
    const lanes = makeLanes();
    stripLaneImages(lanes);
    expect(lanes[0].shots[0].image).toBe('https://img.test/1.jpg');
  });
});

// ---------------------------------------------------------------------------
// buildPdfInputs
// ---------------------------------------------------------------------------
describe('buildPdfInputs', () => {
  it('returns the same options object reference (no cloning)', () => {
    const options = makeOptions();
    const result = buildPdfInputs({ options, lanes: makeLanes(), laneSummary: SUMMARY, talentSummary: TALENT });
    expect(result.options).toBe(options);
  });

  it('returns lanes with images when fields.image=true', () => {
    const options = makeOptions({ fields: { image: true } });
    const lanes = makeLanes();
    const result = buildPdfInputs({ options, lanes, laneSummary: SUMMARY, talentSummary: TALENT });
    // Lanes should be passed through (not stripped)
    expect(result.lanes[0].shots[0].image).toBe('https://img.test/1.jpg');
  });

  it('returns lanes with images stripped when fields.image=false', () => {
    const options = makeOptions({ fields: { image: false } });
    const lanes = makeLanes();
    const result = buildPdfInputs({ options, lanes, laneSummary: SUMMARY, talentSummary: TALENT });
    result.lanes.forEach((lane) => {
      lane.shots.forEach((shot) => {
        expect(shot.image).toBeNull();
      });
    });
  });

  it('meta.imagesEnabled reflects options.fields.image', () => {
    const on = buildPdfInputs({ options: makeOptions({ fields: { image: true } }), lanes: makeLanes(), laneSummary: SUMMARY, talentSummary: TALENT });
    const off = buildPdfInputs({ options: makeOptions({ fields: { image: false } }), lanes: makeLanes(), laneSummary: SUMMARY, talentSummary: TALENT });
    expect(on.meta.imagesEnabled).toBe(true);
    expect(off.meta.imagesEnabled).toBe(false);
  });

  it('meta.lanesCount and shotsCountTotal are correct', () => {
    const result = buildPdfInputs({ options: makeOptions(), lanes: makeLanes(), laneSummary: SUMMARY, talentSummary: TALENT });
    expect(result.meta.lanesCount).toBe(2);
    expect(result.meta.shotsCountTotal).toBe(4);
  });

  it('meta.shotsWithImageCount counts shots with renderable images', () => {
    const options = makeOptions({ fields: { image: true } });
    const result = buildPdfInputs({ options, lanes: makeLanes(), laneSummary: SUMMARY, talentSummary: TALENT });
    // s1: has direct image → true
    // s2: no direct image but has product fallback + fallbackToProductImages → true
    // s3: has direct image → true
    // s4: no image, no fallback → false
    expect(result.meta.shotsWithImageCount).toBe(3);
  });

  it('meta.shotsWithImageCount is 0 when images disabled', () => {
    const options = makeOptions({ fields: { image: false } });
    const result = buildPdfInputs({ options, lanes: makeLanes(), laneSummary: SUMMARY, talentSummary: TALENT });
    expect(result.meta.shotsWithImageCount).toBe(0);
  });

  describe('determinism — identical inputs produce identical outputs', () => {
    it('two calls with same inputs produce structurally identical meta', () => {
      const options = makeOptions();
      const lanes = makeLanes();
      const a = buildPdfInputs({ options, lanes, laneSummary: SUMMARY, talentSummary: TALENT });
      const b = buildPdfInputs({ options, lanes, laneSummary: SUMMARY, talentSummary: TALENT });
      expect(a.meta).toEqual(b.meta);
      expect(a.options).toBe(b.options);
      expect(a.laneSummary).toBe(b.laneSummary);
      expect(a.talentSummary).toBe(b.talentSummary);
    });
  });

  describe('image gate is ONLY dependent on options.fields.image', () => {
    it('ignores legacy includeImages when fields.image is explicitly set', () => {
      const optOn = makeOptions({ fields: { image: true }, includeImages: false });
      const resultOn = buildPdfInputs({ options: optOn, lanes: makeLanes(), laneSummary: SUMMARY, talentSummary: TALENT });
      // fields.image=true → images should be present
      expect(resultOn.lanes[0].shots[0].image).toBe('https://img.test/1.jpg');
      expect(resultOn.meta.imagesEnabled).toBe(true);

      const optOff = makeOptions({ fields: { image: false }, includeImages: true });
      const resultOff = buildPdfInputs({ options: optOff, lanes: makeLanes(), laneSummary: SUMMARY, talentSummary: TALENT });
      // fields.image=false → images should be stripped
      resultOff.lanes.forEach((lane) => {
        lane.shots.forEach((shot) => {
          expect(shot.image).toBeNull();
        });
      });
      expect(resultOff.meta.imagesEnabled).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// logPdfInputs — DEV-only logging
// ---------------------------------------------------------------------------
describe('logPdfInputs', () => {
  it('logs in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const meta = { imagesEnabled: true, lanesCount: 2, shotsCountTotal: 4, shotsWithImageCount: 3 };
      const options = makeOptions();
      logPdfInputs('open-preview', meta, options);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toContain('[PDF-INPUTS]');
      expect(spy.mock.calls[0][0]).toContain('source=open-preview');
      spy.mockRestore();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('does not log in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logPdfInputs('export-pdf', { imagesEnabled: false, lanesCount: 0, shotsCountTotal: 0, shotsWithImageCount: 0 }, {});
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
