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
  await expect(searchText).toEqual(searchString);
});
