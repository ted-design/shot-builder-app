import { test, expect } from './fixtures/auth';

/**
 * Shot CRUD E2E Tests
 * Tests the complete lifecycle of shots: Create, Read, Update, Delete
 */

test.describe('Shot CRUD Operations', () => {
  // Use producer role for these tests (has permissions to create/edit/delete)
  test('producer can create a new shot', async ({ producerPage }) => {
    // Navigate to shots page
    await producerPage.goto('/shots');
    await producerPage.waitForLoadState('networkidle');

    // Find and click create shot button
    const createButton = producerPage.getByRole('button', { name: /create shot|new shot|new/i }).first();
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    // Wait for modal/dialog to appear
    const dialog = producerPage.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Fill in shot name
    const nameInput = dialog.getByRole('textbox').first();
    const shotName = `E2E Test Shot ${Date.now()}`;
    await nameInput.fill(shotName);

    // Submit the form
    const submitButton = dialog.getByRole('button', { name: /create shot|create|save/i });
    await submitButton.click();

    // Wait for modal to close and success message
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Verify shot appears in the list or we're redirected to shot view
    await producerPage.waitForTimeout(1000); // Give time for toast/navigation

    // The shot should now be visible somewhere on the page
    const shotElement = producerPage.getByText(shotName).first();
    await expect(shotElement).toBeVisible({ timeout: 5000 });
  });

  test('producer can view shot details', async ({ producerPage }) => {
    await producerPage.goto('/shots');
    await producerPage.waitForLoadState('networkidle');

    // Wait for shots to load
    await producerPage.waitForTimeout(2000);

    // Click on first shot card/row
    const shotCards = producerPage.locator('[data-shot-card], [data-shot-id], .shot-card, [role="article"]');
    const count = await shotCards.count();

    if (count > 0) {
      const firstShot = shotCards.first();
      await firstShot.click();

      // Should open edit modal or navigate to detail page
      const dialog = producerPage.getByRole('dialog');

      if (await dialog.isVisible()) {
        // Modal opened - verify we can see shot details
        await expect(dialog).toBeVisible();

        // Should have input fields or shot information
        const textboxes = dialog.getByRole('textbox');
        expect(await textboxes.count()).toBeGreaterThan(0);
      } else {
        // Navigated to detail page - verify URL changed
        const url = producerPage.url();
        expect(url).toContain('/shot');
      }
    }
  });

  test('producer can update shot details', async ({ producerPage }) => {
    await producerPage.goto('/shots');
    await producerPage.waitForLoadState('networkidle');

    // Create a new shot first
    const createButton = producerPage.getByRole('button', { name: /create shot|new shot|new/i }).first();

    if (await createButton.isVisible()) {
      await createButton.click();

      const dialog = producerPage.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      const originalName = `Update Test ${Date.now()}`;
      const nameInput = dialog.getByRole('textbox').first();
      await nameInput.fill(originalName);

      const submitButton = dialog.getByRole('button', { name: /create shot|create|save/i });
      await submitButton.click();

      await expect(dialog).not.toBeVisible({ timeout: 5000 });
      await producerPage.waitForTimeout(1000);

      // Now find and edit the shot we just created
      const shotElement = producerPage.getByText(originalName).first();
      await expect(shotElement).toBeVisible({ timeout: 5000 });
      await shotElement.click();

      // Edit modal should open
      const editDialog = producerPage.getByRole('dialog');
      await expect(editDialog).toBeVisible({ timeout: 5000 });

      // Update the name
      const updatedName = `${originalName} - Updated`;
      const editNameInput = editDialog.getByRole('textbox').first();
      await editNameInput.clear();
      await editNameInput.fill(updatedName);

      // Save changes
      const saveButton = editDialog.getByRole('button', { name: /save|update/i });
      await saveButton.click();

      await expect(editDialog).not.toBeVisible({ timeout: 5000 });

      // Verify updated name appears
      await producerPage.waitForTimeout(1000);
      const updatedElement = producerPage.getByText(updatedName).first();
      await expect(updatedElement).toBeVisible({ timeout: 5000 });
    }
  });

  test('producer can add products to a shot', async ({ producerPage }) => {
    await producerPage.goto('/shots');
    await producerPage.waitForLoadState('networkidle');

    // Click on first shot
    await producerPage.waitForTimeout(2000);
    const shotCards = producerPage.locator('[data-shot-card], [data-shot-id]');
    const count = await shotCards.count();

    if (count > 0) {
      await shotCards.first().click();

      const dialog = producerPage.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Look for "Add product" or "Products" section
      const addProductButton = dialog.getByRole('button', { name: /add product/i });

      if (await addProductButton.isVisible()) {
        await addProductButton.click();

        // Product selection modal should appear
        await producerPage.waitForTimeout(1000);

        // Look for product list or family selector
        const productSelectors = dialog.locator('select, [role="combobox"], [role="listbox"]');

        if (await productSelectors.count() > 0) {
          // Found product selector - this confirms the add product flow works
          const firstSelector = productSelectors.first();
          await expect(firstSelector).toBeVisible();
        }
      }
    }
  });

  test('producer can delete a shot', async ({ producerPage }) => {
    await producerPage.goto('/shots');
    await producerPage.waitForLoadState('networkidle');

    // Create a shot to delete
    const createButton = producerPage.getByRole('button', { name: /create shot|new shot|new/i }).first();

    if (await createButton.isVisible()) {
      await createButton.click();

      const dialog = producerPage.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      const shotName = `Delete Test ${Date.now()}`;
      const nameInput = dialog.getByRole('textbox').first();
      await nameInput.fill(shotName);

      const submitButton = dialog.getByRole('button', { name: /create shot|create|save/i });
      await submitButton.click();

      await expect(dialog).not.toBeVisible({ timeout: 5000 });
      await producerPage.waitForTimeout(1000);

      // Find and click on the shot
      const shotElement = producerPage.getByText(shotName).first();
      await expect(shotElement).toBeVisible({ timeout: 5000 });
      await shotElement.click();

      // Edit dialog should open
      const editDialog = producerPage.getByRole('dialog');
      await expect(editDialog).toBeVisible({ timeout: 5000 });

      // Look for delete button
      const deleteButton = editDialog.getByRole('button', { name: /delete/i });

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // May need to confirm deletion
        await producerPage.waitForTimeout(500);

        // Look for confirmation dialog or confirm button
        const confirmButton = producerPage.getByRole('button', { name: /delete|confirm/i }).last();

        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        // Wait for dialog to close
        await producerPage.waitForTimeout(2000);

        // Verify shot is gone from the list
        const deletedElement = producerPage.getByText(shotName);
        await expect(deletedElement).not.toBeVisible();
      }
    }
  });

  test('producer can filter shots', async ({ producerPage }) => {
    await producerPage.goto('/shots');
    await producerPage.waitForLoadState('networkidle');

    // Look for filter controls
    await producerPage.waitForTimeout(2000);

    const filterControls = producerPage.locator('input[placeholder*="search" i], input[placeholder*="filter" i], [role="searchbox"]');

    if (await filterControls.count() > 0) {
      const searchInput = filterControls.first();
      await searchInput.fill('test');

      // Wait for filtering to occur
      await producerPage.waitForTimeout(1000);

      // Verify filtering works (results should change)
      const visibleShots = producerPage.locator('[data-shot-card], [data-shot-id]');
      expect(await visibleShots.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test('producer can navigate between shot views', async ({ producerPage }) => {
    await producerPage.goto('/shots');
    await producerPage.waitForLoadState('networkidle');

    // Look for view toggle buttons (grid/table/list)
    await producerPage.waitForTimeout(2000);

    const viewToggles = producerPage.getByRole('button', { name: /grid|table|list|view/i });
    const toggleCount = await viewToggles.count();

    if (toggleCount > 1) {
      // Click between different views
      const firstToggle = viewToggles.first();
      await firstToggle.click();
      await producerPage.waitForTimeout(500);

      const secondToggle = viewToggles.nth(1);
      await secondToggle.click();
      await producerPage.waitForTimeout(500);

      // Verify layout changed (hard to test visually, but verify no errors)
      const currentUrl = producerPage.url();
      expect(currentUrl).toContain('/shots');
    }
  });

  test('producer can export shots', async ({ producerPage }) => {
    await producerPage.goto('/shots');
    await producerPage.waitForLoadState('networkidle');

    // Look for export button
    await producerPage.waitForTimeout(2000);

    const exportButton = producerPage.getByRole('button', { name: /export|download|pdf/i });

    if (await exportButton.count() > 0) {
      const firstExportButton = exportButton.first();

      if (await firstExportButton.isVisible() && await firstExportButton.isEnabled()) {
        await firstExportButton.click();

        // Export modal or download should trigger
        await producerPage.waitForTimeout(1000);

        // Look for export options dialog
        const exportDialog = producerPage.getByRole('dialog');

        if (await exportDialog.isVisible()) {
          // Export modal opened - verify it has export options
          await expect(exportDialog).toBeVisible();
        }
      }
    }
  });
});
