import { type Page, type Locator } from '@playwright/test';

class CardComponent {
  private rootLocator: Locator;

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
    this.status = this.rootLocator.getByText(/^(Active|Closed|Cancelled)$/);  // RFP status is either Active, Closed or Cancelled
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
  private rootLocator: Locator;

  public readonly previousButton: Locator;
  public readonly nextButton: Locator;
  public readonly eventCardsList: Locator;

  constructor(carouselRootLocator: Locator) {
    const PREVIOUS_ARROW_SVG_PATH = 'M15 19l-7-7 7-7';
    const NEXT_ARROW_SVG_PATH = 'M9 5l7 7-7 7';

    this.rootLocator = carouselRootLocator;
    this.previousButton = this.rootLocator.locator(`button:has(svg path[d="${PREVIOUS_ARROW_SVG_PATH}"])`);
    this.nextButton = this.rootLocator.locator(`button:has(svg path[d="${NEXT_ARROW_SVG_PATH}"])`);
    this.eventCardsList = this.rootLocator.locator('> div:nth-of-type(2) > div > div > div');
  }

  getCard(index: number) {
    return new CardComponent(this.eventCardsList.nth(index));
  }

  async getCardCount(): Promise<number> {
    return this.eventCardsList.count();
  }

  async clickPrevious(): Promise<void> {
    this.previousButton.click();
  }

  async clickNext(): Promise<void> {
    this.nextButton.click();
  }
}

export class RoomingListPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly filtersButton: Locator;
  readonly saveFiltersButton: Locator;
  readonly filterActiveCheckbox: Locator;
  readonly filterClosedCheckbox: Locator;
  readonly filterCancelledCheckbox: Locator;
  readonly eventCarouselsList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder('Search');
    this.filtersButton = page.getByRole('button', { name: 'Filters' });
    this.saveFiltersButton = page.getByRole('button', { name: 'Save' });
    this.filterActiveCheckbox = page.getByLabel('Active');
    this.filterClosedCheckbox = page.getByLabel('Closed');
    this.filterCancelledCheckbox = page.getByLabel('Cancelled');
    this.eventCarouselsList = page.locator('main > div > div');
  }

  async clickSearch(): Promise<void> {
    await this.searchInput.click();
  }

  async searchFor(text: string): Promise<void> {
    await this.clickSearch();
    await this.searchInput.fill(text);
  }

  async openFilters(): Promise<void> {
    await this.filtersButton.click();
  }

  async applyFilters(filters: string[]): Promise<void> {
    await this.openFilters();

    for (const filterName of filters) {
      await this.page.getByLabel(filterName).check();
    }

    await this.saveFiltersButton.click();
  }

  // Handle carousel components
  getCarousel(index: number) {
    return new CarouselComponent(this.eventCarouselsList.nth(index));
  }

  async getCarouselCount(): Promise<number> {
    return this.eventCarouselsList.count();
  }

  // Handle card components

}