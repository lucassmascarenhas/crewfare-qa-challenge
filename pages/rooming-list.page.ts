import { type Page, type Locator } from '@playwright/test';

class CardComponent {
  public readonly rootLocator: Locator;

  public readonly title: Locator;
  public readonly status: Locator;
  public readonly agreementType: Locator;
  public readonly cutOffDateContainer: Locator;
  public readonly cutOffDateMonth: Locator;
  public readonly cutOffDateDay: Locator;
  public readonly viewBookingsButton: Locator;

  constructor(cardRootLocator: Locator) {
    this.rootLocator = cardRootLocator;

    this.title = this.rootLocator.getByText(/^\[.*\]$/);  // Assumes every RFP name is [Enclosed in Square Brackets]
    this.status = this.rootLocator.locator('div[status="Active"], div[status="Closed"], div[status="Cancelled"]').first();  // A little more robust, hopefully
    this.agreementType = this.rootLocator.locator('div:has-text("Agreement:") > span'); // Gets the span with the agreement type
    this.cutOffDateContainer = this.rootLocator.getByText('Cut-Off Date').locator('..');
    this.cutOffDateMonth = this.cutOffDateContainer.getByText(/^[a-z]{3}$/i);
    this.cutOffDateDay = this.cutOffDateContainer.getByText(/^\d{1,2}$/);
    this.viewBookingsButton = this.rootLocator.getByRole('button', { name: /View Bookings/ });
  }

  async getTitle(): Promise<string | null> {
    return this.title.textContent();
  }

  async getStatus(): Promise<string | null> {
    return this.status.textContent();
  }

  async getAgreementType(): Promise<string | null> {
    return this.agreementType.textContent();
  }

  async clickViewBookings(): Promise<void> {
    await this.viewBookingsButton.click();
  }
}

class CarouselComponent {
  public readonly rootLocator: Locator;

  public readonly previousButton: Locator;
  public readonly nextButton: Locator;
  public readonly eventCards: Locator;

  constructor(carouselRootLocator: Locator) {
    const PREVIOUS_ARROW_SVG_PATH = 'M15 19l-7-7 7-7';
    const NEXT_ARROW_SVG_PATH = 'M9 5l7 7-7 7';

    this.rootLocator = carouselRootLocator;
    this.previousButton = this.rootLocator.locator(`button:has(svg path[d="${PREVIOUS_ARROW_SVG_PATH}"])`);
    this.nextButton = this.rootLocator.locator(`button:has(svg path[d="${NEXT_ARROW_SVG_PATH}"])`);
    this.eventCards = this.rootLocator.locator('> div:nth-of-type(2) > div > div > div').locator('> div');
  }

  getCard(index: number) {
    return new CardComponent(this.eventCards.nth(index));
  }

  async getCardList(): Promise<CardComponent[]> {
    const allCardLocators = await this.eventCards.all();
    const visibleCardLocators: Locator[] = [];
    for (const locator of allCardLocators) {
      if (await locator.isVisible()) visibleCardLocators.push(locator);
    }
    const cardComponents = visibleCardLocators.map(locator => new CardComponent(locator));
    return cardComponents;
  }

  async getCardCount(): Promise<number> {
    return this.eventCards.count();
  }

  async clickPrevious(): Promise<void> {
    await this.previousButton.click();
  }

  async clickNext(): Promise<void> {
    await this.nextButton.click();
  }
}

class FilterOption {
  public readonly rootLocator: Locator;
  public readonly svg: Locator;

  constructor(page: Page, label: string) {
    const CHECKMARK_SVG_PATH = 'M5 13l4 4L19 7';
    this.rootLocator = page.getByRole('banner').getByText(label);
    this.svg = this.rootLocator.locator('..').locator(`svg path[d="${CHECKMARK_SVG_PATH}"]`);
  }

  async isChecked(): Promise<boolean> {
    return await this.svg.isVisible();
  }

  async setChecked(checked: boolean): Promise<void> {
    const current = await this.isChecked();
    if (current != checked) {
      await this.toggle();
    }
  }

  async toggle(): Promise<void> {
    await this.rootLocator.click();
  }
}

export class RoomingListPage {
  public readonly page: Page;
  public readonly searchInput: Locator;
  public readonly filtersButton: Locator;
  public readonly saveFiltersButton: Locator;
  public readonly filterActive: FilterOption;
  public readonly filterClosed: FilterOption;
  public readonly filterCancelled: FilterOption;
  public readonly eventCarousels: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder('Search');
    this.filtersButton = page.getByRole('button', { name: 'Filters' });
    this.saveFiltersButton = page.getByRole('button', { name: 'Save' });
    this.filterActive = new FilterOption(page, 'Active');
    this.filterClosed = new FilterOption(page, 'Closed');
    this.filterCancelled = new FilterOption(page, 'Cancelled');
    this.eventCarousels = page.locator('main > div > div');
  }

  async clickSearch(): Promise<void> {
    await this.searchInput.click();
  }

  async getSearchText(): Promise<string | null> {
    return this.searchInput.inputValue();
  }

  async searchFor(text: string): Promise<void> {
    await this.clickSearch();
    await this.searchInput.fill(text);
  }

  async openFilters(): Promise<void> {
    await this.filtersButton.click();
  }

  async clearFilters(): Promise<void> {
    await this.filterActive.setChecked(false);
    await this.filterClosed.setChecked(false);
    await this.filterCancelled.setChecked(false);
  }

  async saveFilters(): Promise<void> {
    await this.saveFiltersButton.click();
  }

  async setFilters(filters: { active?: boolean; closed?: boolean; cancelled?: boolean }): Promise<void> {
    await this.openFilters();
    await this.clearFilters();

    if (filters.active !== undefined) {
      await this.filterActive.setChecked(filters.active);
    }
    if (filters.closed !== undefined) {
      await this.filterClosed.setChecked(filters.closed);
    }
    if (filters.cancelled !== undefined) {
      await this.filterCancelled.setChecked(filters.cancelled);
    }

    await this.saveFilters();
  }

  async getFilters(): Promise<{ active?: boolean, closed?: boolean, cancelled?: boolean }> {
    const filters: { active?: boolean, closed?: boolean, cancelled?: boolean } = {};
    await this.openFilters();

    filters.active = await this.filterActive.isChecked();
    filters.closed = await this.filterClosed.isChecked();
    filters.cancelled = await this.filterCancelled.isChecked();

    return filters;
  }

  // Methods for carousel manipulation
  getCarousel(index: number) {
    return new CarouselComponent(this.eventCarousels.nth(index));
  }

  async getCarouselList(): Promise<CarouselComponent[]> {
    const allCarouselLocators = await this.eventCarousels.all();

    const carouselComponents = allCarouselLocators.map(locator =>
      new CarouselComponent(locator)
    );

    return carouselComponents;
  }

  async getCarouselCount(): Promise<number> {
    return this.eventCarousels.count();
  }

  // Methods for card manipulation
  async forEachCard(callback: (card: CardComponent) => Promise<void>): Promise<void> {
    const carouselList = await this.getCarouselList();
    for (const carousel of carouselList) {
      const cardList = await carousel.getCardList();
      for (const card of cardList) {
        await callback(card);
      }
    }
  }
}