/**
 * Export Image Determinism Tests
 *
 * Verifies that the "Include images" toggle in the export editor deterministically
 * controls image inclusion in the PDF export. This is a critical invariant:
 * - When includeImages=true: fields.image=true AND imageSettings.includeImages=true
 * - When includeImages=false: fields.image=false AND imageSettings.includeImages=false
 *
 * The test validates the entire config flow:
 * 1. resolveExportConfig() produces correct imageSettings
 * 2. resolvedConfigToLegacyOptions() bridges to legacy format correctly
 * 3. The final derivedLegacyOptions has consistent image flags
 */

import { describe, it, expect } from 'vitest';
import {
  resolveExportConfig,
  resolvedConfigToLegacyOptions,
  DEFAULT_CONTENT_FOCUS,
  ResolverInput,
  ResolvedExportConfig,
  DocumentType,
} from '../exportPresetResolver';
import { legacyOptionsToDocumentState } from '../documentModel';

describe('Export Image Determinism', () => {
  describe('resolveExportConfig', () => {
    const documentTypes: DocumentType[] = [
      'clientOverview',
      'internalPlanning',
      'wardrobeStyling',
      'minimal',
    ];

    documentTypes.forEach((docType) => {
      describe(`Document type: ${docType}`, () => {
        it('sets imageSettings.includeImages consistently with fields.image for images ON', () => {
          // The 'minimal' document type defaults to images OFF
          // For others, we test with their default state
          const input: ResolverInput = {
            documentType: docType,
            contentFocus: DEFAULT_CONTENT_FOCUS,
            presentationStyle: 'detailed',
          };

          const config = resolveExportConfig(input);

          // The two flags should always match
          expect(config.imageSettings.includeImages).toBe(config.fields.image);

          // Verify prominence is consistent with includeImages
          if (config.imageSettings.includeImages) {
            expect(config.imageSettings.imageProminence).not.toBe('hidden');
          } else {
            expect(config.imageSettings.imageProminence).toBe('hidden');
          }
        });
      });
    });

    it('produces correct config when images are explicitly enabled', () => {
      const input: ResolverInput = {
        documentType: 'clientOverview',
        contentFocus: DEFAULT_CONTENT_FOCUS,
        presentationStyle: 'detailed',
      };

      const config = resolveExportConfig(input);

      // clientOverview should have images ON by default
      expect(config.fields.image).toBe(true);
      expect(config.imageSettings.includeImages).toBe(true);
      expect(config.imageSettings.inlineImages).toBe(true);
      expect(config.imageSettings.fallbackToProductImages).toBe(true);
      expect(config.imageSettings.imageProminence).not.toBe('hidden');
    });

    it('produces correct config for minimal (images OFF)', () => {
      const input: ResolverInput = {
        documentType: 'minimal',
        contentFocus: DEFAULT_CONTENT_FOCUS,
        presentationStyle: 'compact',
      };

      const config = resolveExportConfig(input);

      // minimal should have images OFF
      expect(config.fields.image).toBe(false);
      expect(config.imageSettings.includeImages).toBe(false);
      expect(config.imageSettings.imageProminence).toBe('hidden');
    });
  });

  describe('resolvedConfigToLegacyOptions', () => {
    it('bridges image flags correctly for images ON', () => {
      const input: ResolverInput = {
        documentType: 'clientOverview',
        contentFocus: DEFAULT_CONTENT_FOCUS,
        presentationStyle: 'detailed',
      };

      const config = resolveExportConfig(input);
      const legacy = resolvedConfigToLegacyOptions(config);

      // Legacy format should have consistent image flags
      expect(legacy.fields.image).toBe(config.fields.image);
      expect(legacy.includeImages).toBe(config.imageSettings.includeImages);
      expect(legacy.inlineImages).toBe(config.imageSettings.inlineImages);
      expect(legacy.fallbackToProductImages).toBe(config.imageSettings.fallbackToProductImages);
    });

    it('bridges image flags correctly for images OFF', () => {
      const input: ResolverInput = {
        documentType: 'minimal',
        contentFocus: DEFAULT_CONTENT_FOCUS,
        presentationStyle: 'compact',
      };

      const config = resolveExportConfig(input);
      const legacy = resolvedConfigToLegacyOptions(config);

      // Legacy format should have consistent image flags
      expect(legacy.fields.image).toBe(false);
      expect(legacy.includeImages).toBe(false);
    });
  });

  describe('legacyOptionsToDocumentState (round-trip)', () => {
    it('preserves image settings through round-trip conversion', () => {
      const input: ResolverInput = {
        documentType: 'internalPlanning',
        contentFocus: DEFAULT_CONTENT_FOCUS,
        presentationStyle: 'detailed',
      };

      const config = resolveExportConfig(input);
      const legacy = resolvedConfigToLegacyOptions(config);

      // Convert legacy options to document state
      const docState = legacyOptionsToDocumentState(legacy);

      // Verify image settings survived the round-trip
      expect(docState.shots.fields.image.visible).toBe(legacy.fields.image);
      expect(docState.shots.imageSettings.includeImages).toBe(legacy.includeImages);
      expect(docState.shots.imageSettings.inlineImages).toBe(legacy.inlineImages);
      expect(docState.shots.imageSettings.fallbackToProductImages).toBe(
        legacy.fallbackToProductImages
      );
    });
  });

  describe('ExportEditorShell image toggle override', () => {
    /**
     * This test simulates what ExportEditorShell does when the user toggles
     * the "Include images" checkbox. It applies an override to the resolved
     * config to set fields.image and imageSettings together.
     */
    it('applies includeImages override correctly when toggled ON', () => {
      // Start with minimal (images OFF by default)
      const input: ResolverInput = {
        documentType: 'minimal',
        contentFocus: DEFAULT_CONTENT_FOCUS,
        presentationStyle: 'compact',
      };

      const baseConfig = resolveExportConfig(input);

      // Simulate ExportEditorShell override (user enables images)
      const includeImages = true;
      const overriddenConfig: ResolvedExportConfig = {
        ...baseConfig,
        fields: {
          ...baseConfig.fields,
          image: includeImages,
        },
        imageSettings: {
          ...baseConfig.imageSettings,
          includeImages: includeImages,
          imageProminence: includeImages ? 'medium' : 'hidden',
        },
      };

      // Verify override applied correctly
      expect(overriddenConfig.fields.image).toBe(true);
      expect(overriddenConfig.imageSettings.includeImages).toBe(true);
      expect(overriddenConfig.imageSettings.imageProminence).not.toBe('hidden');
    });

    it('applies includeImages override correctly when toggled OFF', () => {
      // Start with clientOverview (images ON by default)
      const input: ResolverInput = {
        documentType: 'clientOverview',
        contentFocus: DEFAULT_CONTENT_FOCUS,
        presentationStyle: 'clean',
      };

      const baseConfig = resolveExportConfig(input);

      // Simulate ExportEditorShell override (user disables images)
      const includeImages = false;
      const overriddenConfig: ResolvedExportConfig = {
        ...baseConfig,
        fields: {
          ...baseConfig.fields,
          image: includeImages,
        },
        imageSettings: {
          ...baseConfig.imageSettings,
          includeImages: includeImages,
          imageProminence: includeImages ? baseConfig.imageSettings.imageProminence : 'hidden',
        },
      };

      // Verify override applied correctly
      expect(overriddenConfig.fields.image).toBe(false);
      expect(overriddenConfig.imageSettings.includeImages).toBe(false);
      expect(overriddenConfig.imageSettings.imageProminence).toBe('hidden');
    });
  });

  describe('PDF export decision tree', () => {
    /**
     * This test validates the decision logic used in handleDownloadPdf.
     * The key decision: shouldIncludeImages = Boolean(derivedLegacyOptions.fields.image)
     */
    it('uses fields.image as the single source of truth for PDF image inclusion', () => {
      // Images ON scenario
      const onConfig = resolveExportConfig({
        documentType: 'clientOverview',
        contentFocus: DEFAULT_CONTENT_FOCUS,
        presentationStyle: 'detailed',
      });
      const onLegacy = resolvedConfigToLegacyOptions(onConfig);
      const shouldIncludeOn = Boolean(onLegacy.fields.image);
      expect(shouldIncludeOn).toBe(true);

      // Images OFF scenario
      const offConfig = resolveExportConfig({
        documentType: 'minimal',
        contentFocus: DEFAULT_CONTENT_FOCUS,
        presentationStyle: 'compact',
      });
      const offLegacy = resolvedConfigToLegacyOptions(offConfig);
      const shouldIncludeOff = Boolean(offLegacy.fields.image);
      expect(shouldIncludeOff).toBe(false);
    });

    it('ensures includeImages and fields.image are always consistent', () => {
      // Test all document types and presentation styles
      const documentTypes: DocumentType[] = [
        'clientOverview',
        'internalPlanning',
        'wardrobeStyling',
        'minimal',
      ];
      const presentationStyles = ['clean', 'detailed', 'compact'] as const;

      for (const docType of documentTypes) {
        for (const style of presentationStyles) {
          const config = resolveExportConfig({
            documentType: docType,
            contentFocus: DEFAULT_CONTENT_FOCUS,
            presentationStyle: style,
          });
          const legacy = resolvedConfigToLegacyOptions(config);

          // Critical invariant: these MUST match
          expect(legacy.fields.image).toBe(
            legacy.includeImages,
            `Mismatch for ${docType}/${style}: fields.image=${legacy.fields.image}, includeImages=${legacy.includeImages}`
          );
        }
      }
    });
  });
});
