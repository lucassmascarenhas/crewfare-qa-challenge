import { test, expect } from '@playwright/test';
import { RoomingListPage } from '../pages/rooming-list.page';
import mockRoomingLists from '../test-data/mock-rooming-lists.json';

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
  const searchString = 'Crew';  // In the future, implement dynamically by retrieving events from the db, or intercept request, or maintain a test data file
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

      let selectedStatuses: string[] = [];
      if (filters.active) selectedStatuses.push('Active');
      if (filters.closed) selectedStatuses.push('Closed');
      if (filters.cancelled) selectedStatuses.push('Cancelled');

      // No filters selected = show everything by default
      if (selectedStatuses.length === 0) {
        selectedStatuses = ['Active', 'Closed', 'Cancelled'];
      }

      const carouselList = await roomingListPage.getCarouselList();
      expect(carouselList.length).toBeGreaterThan(0);

      await roomingListPage.setFilters(filters);

      for (const carousel of carouselList) {
        // Scroll over all event cards, using a Set to guarantee uniqueness
        const allTitlesInCarousel = new Set<string>();

        while (await carousel.isNextButtonVisible()) {
          const visibleTitles = await carousel.getAllEventCardsTitles();
          visibleTitles.forEach(title => allTitlesInCarousel.add(title));

          await carousel.clickNext();
        }
        // Get the last set of visible titles after the final click
        const lastVisibleTitles = await carousel.getAllEventCardsTitles();
        lastVisibleTitles.forEach(title => allTitlesInCarousel.add(title));
      
        for (const title of allTitlesInCarousel) {
          const card = roomingListPage.getCardByTitle(title);
        
          expect(selectedStatuses).toContain(await card.getStatus());
        }
      }
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

test('TC12: Verify that event cards are displayed grouped by event ID', async ({ page }) => {
  const roomingListPage = new RoomingListPage(page);

  // Create a map where the key = eventId and value = an array of event card titles from mock data
  const expectedGroups = new Map<string, string[]>();
  for (const item of mockRoomingLists) {
    if (!expectedGroups.has(item.eventId)) {
      expectedGroups.set(item.eventId, []);
    }
    expectedGroups.get(item.eventId)?.push(`[${item.rfpName}]`);
  }
  // Sort the arrays for .toEqual()
  expectedGroups.forEach(titles => titles.sort());

  // Mock a standard response from the server
  await page.route('**/rooming-lists*', route => route.fulfill({ json: mockRoomingLists }));
  await page.goto('/');

  const carouselList = await roomingListPage.getCarouselList();
  const foundEventIds = new Set<string>();

  // Assert that the number of carousels on the page matches the number of unique events
  expect(carouselList.length).toBe(expectedGroups.size);

  for (const carousel of carouselList) {
    // Get the actual titles from the UI and sort them
    const actualTitles = await carousel.getAllEventCardsTitles();
    actualTitles.sort();

    let matchFound = false;
    for (const [eventId, expectedTitles] of expectedGroups.entries()) {
      // .toEqual() for deep array comparison
      try {
        expect(actualTitles).toEqual(expectedTitles);
        // If it matches, record the eventId and stop searching for this carousel
        foundEventIds.add(eventId);
        matchFound = true;
        break;
      } catch (e) {
        // No match
      }
    }
    // Fail the test if a carousel on the page doesn't match any expected group
    expect(matchFound, `A carousel with titles [${actualTitles.join(', ')}] was found on the page but did not match any expected event group.`).toBe(true);
  }

  // Final check to make sure all groups are on the page
  expect(foundEventIds.size).toBe(expectedGroups.size);
});

test('TC13: Verify that each event card displays the RFP name, Agreement type, and Cut-Off Date', async ({ page }) => {
  const roomingListPage = new RoomingListPage(page);
  await page.goto('/');

  const carouselList = await roomingListPage.getCarouselList();
  expect(carouselList.length).toBeGreaterThan(0);

  for (const carousel of carouselList) {
    // Scroll over all event cards, using a Set to guarantee uniqueness
    const allTitlesInCarousel = new Set<string>();
    
    while (await carousel.isNextButtonVisible()) {
      const visibleTitles = await carousel.getAllEventCardsTitles();
      visibleTitles.forEach(title => allTitlesInCarousel.add(title));
      
      await carousel.clickNext();
    }
    // Get the last set of visible titles after the final click
    const lastVisibleTitles = await carousel.getAllEventCardsTitles();
    lastVisibleTitles.forEach(title => allTitlesInCarousel.add(title));

    for (const title of allTitlesInCarousel) {
      const card = roomingListPage.getCardByTitle(title);

      await expect(card.agreementType).toBeVisible();
      await expect(card.cutOffDateContainer).toBeVisible();
    }
  }
});

test('TC14: Verify that the View Bookings button is displayed on each event card', async ({ page }) => {
  const roomingListPage = new RoomingListPage(page);
  await page.goto('/');

  const carouselList = await roomingListPage.getCarouselList();
  expect(carouselList.length).toBeGreaterThan(0);

  for (const carousel of carouselList) {
    // Scroll over all event cards, using a Set to guarantee uniqueness
    const allTitlesInCarousel = new Set<string>();
    
    while (await carousel.isNextButtonVisible()) {
      const visibleTitles = await carousel.getAllEventCardsTitles();
      visibleTitles.forEach(title => allTitlesInCarousel.add(title));
      
      await carousel.clickNext();
    }
    // Get the last set of visible titles after the final click
    const lastVisibleTitles = await carousel.getAllEventCardsTitles();
    lastVisibleTitles.forEach(title => allTitlesInCarousel.add(title));

    for (const title of allTitlesInCarousel) {
      const card = roomingListPage.getCardByTitle(title);

      await expect(card.viewBookingsButton).toBeVisible();
    }
  }
});

test('TC15: Verify that the View Bookings button displays the correct number of bookings', async ({ page }) => {
  const roomingListPage = new RoomingListPage(page);
  await page.goto('/');

  const carouselList = await roomingListPage.getCarouselList();
  expect(carouselList.length).toBeGreaterThan(0);

  for (const carousel of carouselList) {
    // Scroll over all event cards, using a Set to guarantee uniqueness
    const allTitlesInCarousel = new Set<string>();
    
    while (await carousel.isNextButtonVisible()) {
      const visibleTitles = await carousel.getAllEventCardsTitles();
      visibleTitles.forEach(title => allTitlesInCarousel.add(title));
      
      await carousel.clickNext();
    }
    // Get the last set of visible titles after the final click
    const lastVisibleTitles = await carousel.getAllEventCardsTitles();
    lastVisibleTitles.forEach(title => allTitlesInCarousel.add(title));

    for (const title of allTitlesInCarousel) {
      const card = roomingListPage.getCardByTitle(title);
      const buttonCount = await card.getBookingsCount();
      await card.clickViewBookings();
      const modalCount = await roomingListPage.getModalBookingsCount();
      await page.pause();
      expect(buttonCount).toEqual(modalCount);
      await roomingListPage.closeBookingsModal();
    }
  }
});

test('TC16: Verify that clicking on the View Bookings button opens the correct booking details', async ({ page }) => {
  
});

test('TC17: Verify that event cards can be scrolled horizontally if there are many', async ({ page }) => {
  const roomingListPage = new RoomingListPage(page);

  // Mock a standard response from the server
  await page.route('**/rooming-lists*', async route => {
    route.fulfill({ body: JSON.stringify(mockRoomingLists) });
  });
  await page.goto('/');

  const carousels = await roomingListPage.getCarouselList();

  for (let i = 0; i < carousels.length; i++) {
    const carousel = carousels[i];

    // Screenshot before scrolling
    const before = await carousel.rootLocator.screenshot();

    await carousel.clickNext();
    await page.waitForTimeout(500); // Adjust if needed for animation

    // Screenshot after scrolling
    const after = await carousel.rootLocator.screenshot();

    // Compare screenshots
    expect(after).not.toEqual(before);  // Fragile, could be improved
  }
});

test('TC18: Verify that the page title Rooming List Management: Events is displayed', async ({ page }) => {
  const roomingListPage = new RoomingListPage(page);
  await page.goto('/');

  await expect(roomingListPage.title).toBeVisible();
});

test('TC19: Verify that the filters dropdown is correctly positioned under the Filters button', async ({ page }) => {
  const roomingListPage = new RoomingListPage(page);

  // Mock a standard response from the server
  await page.route('**/rooming-lists*', async route => {
    route.fulfill({ body: JSON.stringify(mockRoomingLists) });
  });
  await page.goto('/');

  await roomingListPage.openFilters();
  await roomingListPage.clearFilters();

  const buttonBox = await roomingListPage.filtersButton.boundingBox();
  const dropdownBox = await roomingListPage.filtersMenu.boundingBox();
  
  expect(buttonBox).not.toBeNull();
  expect(dropdownBox).not.toBeNull();

  if (buttonBox && dropdownBox) {
    // Verify the dropdown is below the button
    const bottomOfButton = buttonBox.y + buttonBox.height;
    expect(dropdownBox.y).toBeGreaterThan(bottomOfButton);

    // Verify the left edges are aligned with tolerance
    const alignmentDifference = Math.abs(dropdownBox.x - buttonBox.x);
    expect(alignmentDifference).toBeLessThanOrEqual(2); // Can change tolerance here
  }
});

test('TC20: Verify that each event group has a clear visual separator', async ({ page }) => {
  // Mock a standard response from the server
  await page.route('**/rooming-lists*', async route => {
    route.fulfill({ body: JSON.stringify(mockRoomingLists) });
  });
  await page.goto('/');

  // Screenshot the main container with the event groups
  await expect(page.getByRole('main')).toHaveScreenshot('event-group-layout.png', {
    // Probably won't need a threshold/maxDiff for this specific case
    animations: 'disabled'
  });
});

test('TC21: Verify the behavior when no events are available', async ({ page }) => {
  const roomingListPage = new RoomingListPage(page);

  // Mock an empty response from the server
  await page.route('**/rooming-lists*', async route => {
    route.fulfill({ body: JSON.stringify([]) });
  });
  await page.goto('/');

  await expect(roomingListPage.noResultsMsg).toBeVisible();
});

test('TC22: Verify if search and filters work together', async ({ page }) => {
  const roomingListPage = new RoomingListPage(page);
  await page.goto('/');

  const searchString = 'Crew';
  const expectedStatuses = ['Active'];

  await roomingListPage.setFilters({ active: true, closed: false, cancelled: false });
  await roomingListPage.searchFor(searchString);
  await page.waitForTimeout(1000);  // Ideally, replace with a proper wait for DOM update

  await roomingListPage.forEachCard(async (card) => {
    const title = await card.getTitle();
    const status = await card.getStatus();

    expect(title).toContain(searchString);
    expect(expectedStatuses).toContain(status);
  });
});

test('TC23: Verify UI responsiveness', async ({ page }) => {
  // Some different viewport sizes to test
  const viewports = [
    { width: 1920, height: 1080, name: 'desktop' }, // Desktop
    { width: 768, height: 1024,  name: 'tablet' },  // Tablet (Portrait)
    { width: 375, height: 667,   name: 'mobile' },  // Mobile (iPhone 8)
  ];

  // Mock an empty response from the server
  await page.route('**/rooming-lists*', route => {
    route.fulfill({ json: mockRoomingLists });
  });

  await page.goto('/');

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(500); // Ideally, replace with a proper wait for DOM update

    await expect(page).toHaveScreenshot(`responsive-layout-${viewport.name}.png`, {
      animations: 'disabled'
    });
  }
});