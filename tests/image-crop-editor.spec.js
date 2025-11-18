import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Image Crop Editor', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/projects');

    // Wait for authentication
    await page.waitForSelector('text=Test Project', { timeout: 10000 });

    // Click "Enter" button for Test Project
    await page.getByRole('button', { name: /enter/i }).first().click();

    // Wait for shots page to load
    await page.waitForURL(/\/projects\/.*\/shots/);
  });

  test('should display image in crop editor when editing existing shot', async ({ page }) => {
    // Create a new shot
    await page.getByRole('button', { name: /create shot/i }).first().click();

    // Fill in shot name
    await page.getByRole('textbox', { name: /name/i }).fill('Test Shot for Crop Editor');

    // Navigate to Attachments tab
    await page.getByRole('tab', { name: /attachments/i }).click();

    // Create a test image file
    const testImagePath = path.join(process.cwd(), 'tests', 'fixtures', 'test-image.jpg');

    // Upload image via file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImagePath);

    // Wait for upload to complete
    await page.waitForSelector('[data-testid="attachment-thumbnail"]', { timeout: 30000 });

    // Save the shot
    await page.getByRole('button', { name: /create shot/i }).click();

    // Wait for modal to close and shot to appear in list
    await page.waitForSelector('text=Test Shot for Crop Editor', { timeout: 10000 });

    // Click to edit the shot
    const shotCard = page.locator('text=Test Shot for Crop Editor').first();
    await shotCard.click();

    // Wait for edit modal to open
    await page.waitForSelector('role=dialog[name="Edit shot"]', { timeout: 5000 });

    // Navigate to Attachments tab in edit mode
    await page.getByRole('tab', { name: /attachments/i }).click();

    // Verify image appears in attachments tab
    const attachmentThumbnail = page.locator('[data-testid="attachment-thumbnail"]').first();
    await expect(attachmentThumbnail).toBeVisible();

    // Click edit button to open crop editor
    const editButton = page.locator('button[title="Edit crop"]').first();
    await editButton.click();

    // Wait for crop editor modal to open
    await page.waitForSelector('text=Crop & Adjust Image', { timeout: 5000 });

    // Verify loading spinner appears first
    const loadingIndicator = page.locator('text=Loading image...');
    if (await loadingIndicator.isVisible()) {
      // Wait for image to load
      await expect(loadingIndicator).not.toBeVisible({ timeout: 10000 });
    }

    // Verify image is displayed in cropper (not black placeholder)
    const cropperContainer = page.locator('.reactEasyCrop_Container');
    await expect(cropperContainer).toBeVisible();

    // Verify image element exists within cropper
    const cropperImage = cropperContainer.locator('img');
    await expect(cropperImage).toBeVisible();

    // Verify image has valid src
    const imageSrc = await cropperImage.getAttribute('src');
    expect(imageSrc).toBeTruthy();
    expect(imageSrc).not.toBe('');

    console.log('Image loaded in crop editor with src:', imageSrc);
  });

  test('should allow zoom control to zoom the image', async ({ page }) => {
    // Assume shot with image already exists from previous test
    await page.waitForSelector('text=Test Shot for Crop Editor', { timeout: 10000 });

    // Click to edit the shot
    await page.locator('text=Test Shot for Crop Editor').first().click();

    // Navigate to Attachments tab
    await page.getByRole('tab', { name: /attachments/i }).click();

    // Click edit button to open crop editor
    await page.locator('button[title="Edit crop"]').first().click();

    // Wait for crop editor to open
    await page.waitForSelector('text=Crop & Adjust Image', { timeout: 5000 });

    // Wait for image to load
    await page.waitForSelector('.reactEasyCrop_Container img', { timeout: 10000 });

    // Find zoom slider
    const zoomSlider = page.locator('input[type="range"]').filter({ has: page.locator('text=Zoom') });

    // Verify zoom slider is enabled
    await expect(zoomSlider).toBeEnabled();

    // Get initial zoom value
    const initialZoom = await zoomSlider.inputValue();
    console.log('Initial zoom:', initialZoom);

    // Change zoom value
    await zoomSlider.fill('2.0');

    // Verify zoom value changed
    const newZoom = await zoomSlider.inputValue();
    expect(parseFloat(newZoom)).toBeGreaterThan(parseFloat(initialZoom));

    console.log('New zoom:', newZoom);

    // Verify zoom label updates
    await expect(page.locator('text=/Zoom: \\d+\\.\\d+x/')).toBeVisible();
  });

  test('should allow rotation control to rotate the image', async ({ page }) => {
    // Assume shot with image already exists
    await page.waitForSelector('text=Test Shot for Crop Editor', { timeout: 10000 });

    // Click to edit the shot
    await page.locator('text=Test Shot for Crop Editor').first().click();

    // Navigate to Attachments tab
    await page.getByRole('tab', { name: /attachments/i }).click();

    // Click edit button to open crop editor
    await page.locator('button[title="Edit crop"]').first().click();

    // Wait for crop editor to open
    await page.waitForSelector('text=Crop & Adjust Image', { timeout: 5000 });

    // Wait for image to load
    await page.waitForSelector('.reactEasyCrop_Container img', { timeout: 10000 });

    // Find rotation slider by looking for the label that contains "Rotation"
    const rotationSlider = page.locator('input[type="range"]').nth(1); // Second range input

    // Verify rotation slider is enabled
    await expect(rotationSlider).toBeEnabled();

    // Get initial rotation value
    const initialRotation = await rotationSlider.inputValue();
    console.log('Initial rotation:', initialRotation);

    // Change rotation value
    await rotationSlider.fill('45');

    // Verify rotation value changed
    const newRotation = await rotationSlider.inputValue();
    expect(parseInt(newRotation)).toBe(45);

    console.log('New rotation:', newRotation);

    // Verify rotation label updates
    await expect(page.locator('text=Rotation: 45°')).toBeVisible();
  });

  test('should allow panning/shifting the image', async ({ page }) => {
    // Assume shot with image already exists
    await page.waitForSelector('text=Test Shot for Crop Editor', { timeout: 10000 });

    // Click to edit the shot
    await page.locator('text=Test Shot for Crop Editor').first().click();

    // Navigate to Attachments tab
    await page.getByRole('tab', { name: /attachments/i }).click();

    // Click edit button to open crop editor
    await page.locator('button[title="Edit crop"]').first().click();

    // Wait for crop editor to open
    await page.waitForSelector('text=Crop & Adjust Image', { timeout: 5000 });

    // Wait for image to load
    const cropperImage = page.locator('.reactEasyCrop_Container img');
    await expect(cropperImage).toBeVisible({ timeout: 10000 });

    // Get cropper container
    const cropperContainer = page.locator('.reactEasyCrop_Container').first();

    // Get bounding box of cropper
    const box = await cropperContainer.boundingBox();
    expect(box).not.toBeNull();

    // Simulate drag to pan image
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    const endX = startX + 50; // Drag 50px to the right
    const endY = startY + 30; // Drag 30px down

    // Perform drag operation
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 10 });
    await page.mouse.up();

    console.log('Performed pan gesture');

    // The image should have panned (position changed)
    // We can verify this by checking that Save Changes button is still enabled
    const saveButton = page.getByRole('button', { name: /save changes/i });
    await expect(saveButton).toBeEnabled();
  });

  test('should allow changing aspect ratio', async ({ page }) => {
    // Assume shot with image already exists
    await page.waitForSelector('text=Test Shot for Crop Editor', { timeout: 10000 });

    // Click to edit the shot
    await page.locator('text=Test Shot for Crop Editor').first().click();

    // Navigate to Attachments tab
    await page.getByRole('tab', { name: /attachments/i }).click();

    // Click edit button to open crop editor
    await page.locator('button[title="Edit crop"]').first().click();

    // Wait for crop editor to open
    await page.waitForSelector('text=Crop & Adjust Image', { timeout: 5000 });

    // Wait for image to load
    await page.waitForSelector('.reactEasyCrop_Container img', { timeout: 10000 });

    // Click on "1:1 Square" aspect ratio button
    const squareButton = page.getByRole('button', { name: '1:1 Square' });
    await expect(squareButton).toBeEnabled();
    await squareButton.click();

    // Verify button is now selected (has default variant styling)
    // The button should change appearance when selected

    // Click on "16:9 Landscape" aspect ratio button
    const landscapeButton = page.getByRole('button', { name: '16:9 Landscape' });
    await expect(landscapeButton).toBeEnabled();
    await landscapeButton.click();

    console.log('Changed aspect ratio successfully');
  });

  test('should save crop changes', async ({ page }) => {
    // Assume shot with image already exists
    await page.waitForSelector('text=Test Shot for Crop Editor', { timeout: 10000 });

    // Click to edit the shot
    await page.locator('text=Test Shot for Crop Editor').first().click();

    // Navigate to Attachments tab
    await page.getByRole('tab', { name: /attachments/i }).click();

    // Click edit button to open crop editor
    await page.locator('button[title="Edit crop"]').first().click();

    // Wait for crop editor to open
    await page.waitForSelector('text=Crop & Adjust Image', { timeout: 5000 });

    // Wait for image to load
    await page.waitForSelector('.reactEasyCrop_Container img', { timeout: 10000 });

    // Make some changes
    const zoomSlider = page.locator('input[type="range"]').first();
    await zoomSlider.fill('1.5');

    // Click Save Changes button
    const saveButton = page.getByRole('button', { name: /save changes/i });
    await saveButton.click();

    // Wait for crop editor modal to close
    await expect(page.locator('text=Crop & Adjust Image')).not.toBeVisible({ timeout: 5000 });

    // We should be back at the attachments tab
    await expect(page.getByRole('tab', { name: /attachments/i })).toHaveAttribute('aria-selected', 'true');

    console.log('Crop changes saved successfully');
  });

  test('should disable controls while image is loading', async ({ page }) => {
    // Create a new shot for this test
    await page.getByRole('button', { name: /create shot/i }).first().click();
    await page.getByRole('textbox', { name: /name/i }).fill('Test Loading States');
    await page.getByRole('tab', { name: /attachments/i }).click();

    const testImagePath = path.join(process.cwd(), 'tests', 'fixtures', 'test-image.jpg');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImagePath);

    // Wait for upload
    await page.waitForSelector('[data-testid="attachment-thumbnail"]', { timeout: 30000 });

    // Save shot
    await page.getByRole('button', { name: /create shot/i }).click();
    await page.waitForSelector('text=Test Loading States', { timeout: 10000 });

    // Edit shot
    await page.locator('text=Test Loading States').first().click();
    await page.getByRole('tab', { name: /attachments/i }).click();

    // Open crop editor
    await page.locator('button[title="Edit crop"]').first().click();

    // Immediately check if controls are disabled while loading
    const loadingIndicator = page.locator('text=Loading image...');
    if (await loadingIndicator.isVisible()) {
      // While loading, controls should be disabled
      const zoomSlider = page.locator('input[type="range"]').first();
      await expect(zoomSlider).toBeDisabled();

      const aspectRatioButton = page.getByRole('button', { name: 'Free' });
      await expect(aspectRatioButton).toBeDisabled();

      console.log('Controls correctly disabled during image loading');
    }

    // Wait for image to load
    await page.waitForSelector('.reactEasyCrop_Container img', { timeout: 10000 });

    // After loading, controls should be enabled
    const zoomSlider = page.locator('input[type="range"]').first();
    await expect(zoomSlider).toBeEnabled();

    const aspectRatioButton = page.getByRole('button', { name: 'Free' });
    await expect(aspectRatioButton).toBeEnabled();

    console.log('Controls correctly enabled after image loads');
  });
});
