import { test, expect } from '@playwright/test';
import { RoomingListPage } from '../pages/rooming-list.page';

test('TC01: Verify that the Search input is displayed', async ({ page }) => {
  const roomingListPage = new RoomingListPage(page);
  await page.goto('/');

  await expect(roomingListPage.searchInput).toBeVisible();
});

test('TC02: Verify that a user can type text into the Search input', async ({ page }) => {
  const roomingListPage = new RoomingListPage(page);
  const searchString = 'Crew';
  await page.goto('/');

  await roomingListPage.searchFor(searchString);
  let searchText = await roomingListPage.getSearchText();
  expect(searchText).toEqual(searchString);
});

test('TC03: Verify that searching filters the list of events based on input', async ({ page }) => {
  const roomingListPage = new RoomingListPage(page);
  const searchString = 'Crew';  // In the future, implement dynamically by retrieving events from the db if feasible, or intercept request, or maintain a test data file
  await page.goto('/');

  await roomingListPage.searchFor(searchString);
  await page.waitForTimeout(1000);  // Gotta solve this later, couldn't find a good trigger to detect the DOM update yet

  const carouselList = await roomingListPage.getCarouselList();
  for (const carousel of carouselList) {
    const cardList = await carousel.getCardList();
    for (const card of cardList) {
      const cardTitle = await card.getTitle();
      expect(cardTitle).toContain(searchString);
    }
  }
});

test('TC04: Verify that if no matching event is found, a no results message appears', async ({ page }) => {
  const roomingListPage = new RoomingListPage(page);
  const searchString = 'TTT___';
  await page.goto('/');

  await roomingListPage.searchFor(searchString);
  await page.waitForTimeout(1000);  // Gotta solve this later, couldn't find a good trigger to detect the DOM update yet

  await expect(page.getByText('No rooming lists found')).toBeVisible();
});

test('TC05: Verify that the Filters button is displayed', async ({ page }) => {
  const roomingListPage = new RoomingListPage(page);
  await page.goto('/');

  await expect(roomingListPage.filtersButton).toBeVisible();
});

test('TC06: Verify that clicking the Filters button opens the filter dropdown', async ({ page }) => {
  const roomingListPage = new RoomingListPage(page);
  await page.goto('/');

  await roomingListPage.openFilters();
  await expect(page.getByText('RFP status')).toBeVisible();
});

test('TC07: Verify that the filter options are Active, Closed, and Cancelled', async ({ page }) => {
  const roomingListPage = new RoomingListPage(page);
  await page.goto('/');

  await roomingListPage.openFilters();
  await expect(roomingListPage.filterActive.rootLocator).toBeVisible();
  await expect(roomingListPage.filterClosed.rootLocator).toBeVisible();
  await expect(roomingListPage.filterCancelled.rootLocator).toBeVisible();
});

test.describe('Verify if filters are working properly', () => {
  const filterCombinations = [
    { active: true, closed: false, cancelled: false },
    { active: false, closed: true, cancelled: false },
    { active: false, closed: false, cancelled: true },
    { active: true, closed: true, cancelled: false },
    { active: true, closed: false, cancelled: true },
    { active: false, closed: true, cancelled: true },
    { active: true, closed: true, cancelled: true },
    { active: false, closed: false, cancelled: false },
  ];

  // Tests that use multiple filter configurations
  for (const filters of filterCombinations) {
    test(`TC08: Verify event list is filtered correctly: active=${filters.active}, closed=${filters.closed}, cancelled=${filters.cancelled}`, async ({ page }) => {
      const roomingListPage = new RoomingListPage(page);
      await page.goto('/');

      // Get all card statuses before filtering
      const allStatuses: string[] = [];
      await roomingListPage.forEachCard(async (card) => {
        const status = await card.getStatus();
        if (status) allStatuses.push(status);
      });

      // Determine which statuses should be visible after filtering
      let selectedStatuses: string[] = [];
      if (filters.active) selectedStatuses.push('Active');
      if (filters.closed) selectedStatuses.push('Closed');
      if (filters.cancelled) selectedStatuses.push('Cancelled');
      if (selectedStatuses.length === 0) {
        selectedStatuses = ['Active', 'Closed', 'Cancelled']; // Special case: all unchecked = show all
      }

      // Build expected array
      const expected = allStatuses.filter(status => selectedStatuses.includes(status));

      // Apply filters
      await roomingListPage.setFilters(filters);
      await page.waitForTimeout(1000);
      // Get all card statuses after filtering
      const actual: string[] = [];
      await roomingListPage.forEachCard(async (card) => {
        const status = await card.getStatus();
        if (status) actual.push(status);
      });

      expect(actual.sort()).toEqual(expected.sort());
    });

    test(`TC10: Verify filters persist: active=${filters.active}, closed=${filters.closed}, cancelled=${filters.cancelled}`, async ({ page }) => {
      const roomingListPage = new RoomingListPage(page);
      await page.goto('/');

      await roomingListPage.setFilters(filters);
      const savedFilters = await roomingListPage.getFilters();

      expect(savedFilters).toEqual(filters);
    });
  }

  test('TC11: Verify that multiple filters can be selected/deselected', async ({ page }) => {
    const roomingListPage = new RoomingListPage(page);
    await page.goto('/');

    // Open filters and clear all
    await roomingListPage.openFilters();
    await roomingListPage.clearFilters();

    // Check all filters
    await roomingListPage.filterActive.setChecked(true);
    await roomingListPage.filterClosed.setChecked(true);
    await roomingListPage.filterCancelled.setChecked(true);

    // Assert all filters are checked
    expect(await roomingListPage.filterActive.isChecked()).toBe(true);
    expect(await roomingListPage.filterClosed.isChecked()).toBe(true);
    expect(await roomingListPage.filterCancelled.isChecked()).toBe(true);

    // Uncheck all filters
    await roomingListPage.filterActive.setChecked(false);
    await roomingListPage.filterClosed.setChecked(false);
    await roomingListPage.filterCancelled.setChecked(false);

    // Assert all filters are unchecked
    expect(await roomingListPage.filterActive.isChecked()).toBe(false);
    expect(await roomingListPage.filterClosed.isChecked()).toBe(false);
    expect(await roomingListPage.filterCancelled.isChecked()).toBe(false);
  });
});

test('TC18: Verify that the page title Rooming List Management: Events is displayed', async ({ page }) => {
  const roomingListPage = new RoomingListPage(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Rooming List Management: Events' })).toBeVisible();
});

