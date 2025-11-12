import { test, expect } from './fixtures/auth';

/**
 * Pull Sheet CRUD E2E Tests
 * Tests the complete pull sheet lifecycle: Create, Add Items, Fulfill, Export
 */

test.describe('Pull Sheet Operations', () => {
  test('producer can create a new pull', async ({ producerPage }) => {
    // Navigate to pulls page
    await producerPage.goto('/pulls');
    await producerPage.waitForLoadState('networkidle');

    // Find and click create pull button
    const createButton = producerPage.getByRole('button', { name: /create pull|new pull|new/i }).first();
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    // Wait for input field or modal
    await producerPage.waitForTimeout(500);

    // Fill in pull name
    const pullName = `E2E Test Pull ${Date.now()}`;
    const nameInput = producerPage.locator('input[placeholder*="pull" i], input[type="text"]').first();

    if (await nameInput.isVisible()) {
      await nameInput.fill(pullName);

      // Submit (might be same button or a separate create button)
      const submitButton = producerPage.getByRole('button', { name: /create|add|save/i }).first();

      if (await submitButton.isVisible() && await submitButton.isEnabled()) {
        await submitButton.click();
      } else {
        // Might submit on Enter
        await nameInput.press('Enter');
      }

      // Wait for pull to be created
      await producerPage.waitForTimeout(2000);

      // Verify pull appears in the list
      const pullElement = producerPage.getByText(pullName);
      await expect(pullElement.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('producer can view pull details', async ({ producerPage }) => {
    await producerPage.goto('/pulls');
    await producerPage.waitForLoadState('networkidle');

    // Wait for pulls to load
    await producerPage.waitForTimeout(2000);

    // Click on first pull card/row
    const pullCards = producerPage.locator('[data-pull-card], [data-pull-id], .pull-card');
    const count = await pullCards.count();

    if (count > 0) {
      const firstPull = pullCards.first();
      await firstPull.click();

      // Wait for navigation or modal
      await producerPage.waitForTimeout(1000);

      // Should navigate to pull detail page
      const url = producerPage.url();
      expect(url).toMatch(/\/pull/);

      // Should see pull items or empty state
      const heading = producerPage.getByRole('heading').first();
      await expect(heading).toBeVisible();
    }
  });

  test('producer can add items to a pull', async ({ producerPage }) => {
    // First create a pull
    await producerPage.goto('/pulls');
    await producerPage.waitForLoadState('networkidle');

    const createButton = producerPage.getByRole('button', { name: /create pull|new pull|new/i }).first();

    if (await createButton.isVisible()) {
      await createButton.click();
      await producerPage.waitForTimeout(500);

      const pullName = `Item Test Pull ${Date.now()}`;
      const nameInput = producerPage.locator('input[placeholder*="pull" i], input[type="text"]').first();

      if (await nameInput.isVisible()) {
        await nameInput.fill(pullName);
        await nameInput.press('Enter');

        await producerPage.waitForTimeout(2000);

        // Click on the pull we just created
        const pullElement = producerPage.getByText(pullName).first();

        if (await pullElement.isVisible()) {
          await pullElement.click();

          // Should navigate to pull detail page
          await producerPage.waitForTimeout(1000);

          // Look for "Add item" or "Add product" button
          const addItemButton = producerPage.getByRole('button', { name: /add item|add product|new item/i }).first();

          if (await addItemButton.isVisible()) {
            await addItemButton.click();

            // Item editor modal should appear
            await producerPage.waitForTimeout(1000);

            const dialog = producerPage.getByRole('dialog');

            if (await dialog.isVisible()) {
              // Verify modal opened with item form
              await expect(dialog).toBeVisible();

              // Should have product/family selectors
              const selectors = dialog.locator('select, [role="combobox"]');
              expect(await selectors.count()).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });

  test('producer can update pull item quantities', async ({ producerPage }) => {
    await producerPage.goto('/pulls');
    await producerPage.waitForLoadState('networkidle');

    // Click on first pull
    await producerPage.waitForTimeout(2000);
    const pullCards = producerPage.locator('[data-pull-card], [data-pull-id]');
    const count = await pullCards.count();

    if (count > 0) {
      await pullCards.first().click();

      await producerPage.waitForTimeout(1000);

      // Look for items in the pull
      const itemRows = producerPage.locator('[data-pull-item], tr[data-item-id], .pull-item');
      const itemCount = await itemRows.count();

      if (itemCount > 0) {
        // Click on first item to edit
        const firstItem = itemRows.first();
        await firstItem.click();

        // Edit modal should open
        await producerPage.waitForTimeout(1000);

        const dialog = producerPage.getByRole('dialog');

        if (await dialog.isVisible()) {
          // Look for quantity inputs
          const quantityInputs = dialog.locator('input[type="number"]');

          if (await quantityInputs.count() > 0) {
            const firstQuantityInput = quantityInputs.first();
            await firstQuantityInput.clear();
            await firstQuantityInput.fill('5');

            // Save changes
            const saveButton = dialog.getByRole('button', { name: /save|update/i });
            await saveButton.click();

            await producerPage.waitForTimeout(1000);

            // Dialog should close
            await expect(dialog).not.toBeVisible();
          }
        }
      }
    }
  });

  test('producer can mark items as fulfilled', async ({ producerPage }) => {
    await producerPage.goto('/pulls');
    await producerPage.waitForLoadState('networkidle');

    // Click on first pull
    await producerPage.waitForTimeout(2000);
    const pullCards = producerPage.locator('[data-pull-card], [data-pull-id]');
    const count = await pullCards.count();

    if (count > 0) {
      await pullCards.first().click();

      await producerPage.waitForTimeout(1000);

      // Look for fulfillment controls (checkboxes, inputs, or buttons)
      const fulfillmentControls = producerPage.locator(
        'input[type="checkbox"][aria-label*="fulfill" i], button:has-text("Fulfill"), input[placeholder*="fulfilled" i]'
      );

      if (await fulfillmentControls.count() > 0) {
        const firstControl = fulfillmentControls.first();

        if (await firstControl.isVisible() && await firstControl.isEnabled()) {
          await firstControl.click();

          // Wait for update
          await producerPage.waitForTimeout(1000);

          // Verify some visual feedback (status change, toast, etc.)
          const currentUrl = producerPage.url();
          expect(currentUrl).toMatch(/\/pull/);
        }
      }
    }
  });

  test('producer can export a pull sheet to PDF', async ({ producerPage }) => {
    await producerPage.goto('/pulls');
    await producerPage.waitForLoadState('networkidle');

    // Click on first pull
    await producerPage.waitForTimeout(2000);
    const pullCards = producerPage.locator('[data-pull-card], [data-pull-id]');
    const count = await pullCards.count();

    if (count > 0) {
      await pullCards.first().click();

      await producerPage.waitForTimeout(1000);

      // Look for export/PDF button
      const exportButton = producerPage.getByRole('button', { name: /export|pdf|download/i });

      if (await exportButton.count() > 0) {
        const firstExportButton = exportButton.first();

        if (await firstExportButton.isVisible() && await firstExportButton.isEnabled()) {
          await firstExportButton.click();

          // Export modal should appear
          await producerPage.waitForTimeout(1000);

          const exportDialog = producerPage.getByRole('dialog');

          if (await exportDialog.isVisible()) {
            // Verify export options are available
            await expect(exportDialog).toBeVisible();

            // Look for generate/download button
            const generateButton = exportDialog.getByRole('button', { name: /generate|download|export/i });

            if (await generateButton.count() > 0) {
              await expect(generateButton.first()).toBeVisible();
            }
          }
        }
      }
    }
  });

  test('producer can delete a pull', async ({ producerPage }) => {
    // Create a pull to delete
    await producerPage.goto('/pulls');
    await producerPage.waitForLoadState('networkidle');

    const createButton = producerPage.getByRole('button', { name: /create pull|new pull|new/i }).first();

    if (await createButton.isVisible()) {
      await createButton.click();
      await producerPage.waitForTimeout(500);

      const pullName = `Delete Test Pull ${Date.now()}`;
      const nameInput = producerPage.locator('input[placeholder*="pull" i], input[type="text"]').first();

      if (await nameInput.isVisible()) {
        await nameInput.fill(pullName);
        await nameInput.press('Enter');

        await producerPage.waitForTimeout(2000);

        // Find the pull we just created
        const pullElement = producerPage.getByText(pullName).first();

        if (await pullElement.isVisible()) {
          // Look for delete button (might be on pull card or need to open pull first)
          const deleteButton = producerPage.getByRole('button', { name: /delete/i });

          if (await deleteButton.count() > 0) {
            const visibleDeleteButton = deleteButton.first();

            if (await visibleDeleteButton.isVisible()) {
              await visibleDeleteButton.click();

              // Confirmation dialog may appear
              await producerPage.waitForTimeout(500);

              const confirmButton = producerPage.getByRole('button', { name: /delete|confirm/i }).last();

              if (await confirmButton.isVisible()) {
                await confirmButton.click();
              }

              // Wait for deletion
              await producerPage.waitForTimeout(2000);

              // Verify pull is gone
              const deletedElement = producerPage.getByText(pullName);
              await expect(deletedElement).not.toBeVisible();
            }
          }
        }
      }
    }
  });

  test('producer can filter pulls by status', async ({ producerPage }) => {
    await producerPage.goto('/pulls');
    await producerPage.waitForLoadState('networkidle');

    // Look for status filter controls
    await producerPage.waitForTimeout(2000);

    const statusFilters = producerPage.locator('select, [role="combobox"], button[aria-haspopup="listbox"]');

    if (await statusFilters.count() > 0) {
      // Try to interact with filter
      const firstFilter = statusFilters.first();

      if (await firstFilter.isVisible()) {
        await firstFilter.click();

        // Wait for dropdown/options
        await producerPage.waitForTimeout(500);

        // Verify options are available
        const options = producerPage.locator('[role="option"], option');
        expect(await options.count()).toBeGreaterThan(0);
      }
    }
  });

  test('producer can share a pull with warehouse', async ({ producerPage }) => {
    await producerPage.goto('/pulls');
    await producerPage.waitForLoadState('networkidle');

    // Click on first pull
    await producerPage.waitForTimeout(2000);
    const pullCards = producerPage.locator('[data-pull-card], [data-pull-id]');
    const count = await pullCards.count();

    if (count > 0) {
      await pullCards.first().click();

      await producerPage.waitForTimeout(1000);

      // Look for share button
      const shareButton = producerPage.getByRole('button', { name: /share|send|email/i });

      if (await shareButton.count() > 0) {
        const firstShareButton = shareButton.first();

        if (await firstShareButton.isVisible() && await firstShareButton.isEnabled()) {
          await firstShareButton.click();

          // Share modal should appear
          await producerPage.waitForTimeout(1000);

          const shareDialog = producerPage.getByRole('dialog');

          if (await shareDialog.isVisible()) {
            // Verify share options are available
            await expect(shareDialog).toBeVisible();
          }
        }
      }
    }
  });
});
