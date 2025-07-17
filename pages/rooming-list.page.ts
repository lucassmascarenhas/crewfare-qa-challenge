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

  async getBookingsCount(): Promise<number> {
    const buttonText = await this.viewBookingsButton.textContent();

    // Check for null
    if (!buttonText) {
      return 0;
    }
    const match = buttonText.match(/\((\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}

class CarouselComponent {
  public readonly rootLocator: Locator;

  public readonly title: Locator;
  public readonly previousButton: Locator;
  public readonly nextButton: Locator;
  public readonly eventCards: Locator;
  public readonly allEventCardsTitles: Locator;       //
  public readonly allEventCardsStatus: Locator;       //  Ugly but will work without a better selector
  public readonly allEventCardsAgreement: Locator;    //

  constructor(carouselRootLocator: Locator) {
    const PREVIOUS_ARROW_SVG_PATH = 'M15 19l-7-7 7-7';
    const NEXT_ARROW_SVG_PATH = 'M9 5l7 7-7 7';

    this.rootLocator = carouselRootLocator;
    this.title = this.rootLocator.locator('> div').first();
    this.previousButton = this.rootLocator.locator(`button:has(svg path[d="${PREVIOUS_ARROW_SVG_PATH}"])`);
    this.nextButton = this.rootLocator.locator(`button:has(svg path[d="${NEXT_ARROW_SVG_PATH}"])`);
    this.eventCards = this.rootLocator.locator('> div:nth-of-type(2) > div > div > div').locator('> div');
    this.allEventCardsTitles = this.eventCards.locator('div', { hasText: /^\[.*\]$/ });
    this.allEventCardsStatus = this.eventCards.locator('div:has-text("Agreement:") > span');
    this.allEventCardsAgreement = this.eventCards.locator('div[status="Active"], div[status="Closed"], div[status="Cancelled"]').first();
  }

  async getTitle(): Promise<string | null> {
    return this.title.textContent();
  }

  async getAllEventCardsTitles(): Promise<string[]> {
    return await this.allEventCardsTitles.allInnerTexts();
  }

  async getAllEventCardsStatus(): Promise<string[]> {
    return await this.allEventCardsStatus.allInnerTexts();
  }

  async getAllEventCardsAgreement(): Promise<string[]> {
    return await this.allEventCardsAgreement.allInnerTexts();
  }

  getCard(index: number) {
    return new CardComponent(this.eventCards.nth(index));
  }

  async getCardList(): Promise<CardComponent[]> {
    const allCardLocators = await this.eventCards.all();
    const visibleCardLocators: Locator[] = [];
    
    for (const locator of allCardLocators) {
      const box = await locator.boundingBox();
      // Trying this to see if we can get only the shown cards 
      if (box && box.width > 0 && box.height > 0) {
        visibleCardLocators.push(locator);
      }
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

  async isNextButtonVisible(): Promise<boolean> {
    return this.nextButton.isVisible();
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
  public readonly title: Locator;
  public readonly searchInput: Locator;
  public readonly filtersMenu: Locator;
  public readonly filtersButton: Locator;
  public readonly saveFiltersButton: Locator;
  public readonly filterActive: FilterOption;
  public readonly filterClosed: FilterOption;
  public readonly filterCancelled: FilterOption;
  public readonly carouselsContainer: Locator;
  public readonly eventCarousels: Locator;
  public readonly noResultsMsg: Locator;
  public readonly separators: Locator;
  public readonly bookingsModal: Locator;
  public readonly bookings: Locator;
  public readonly bookingsCloseButton: Locator;

  constructor(page: Page) {
    const CLOSE_SVG_PATH = 'M6 18L18 6M6 6l12 12';
    this.page = page;
    this.title = page.getByRole('heading', { name: 'Rooming List Management: Events' });
    this.searchInput = page.getByPlaceholder('Search');
    this.filtersMenu = page.getByText('RFP STATUS').locator('xpath=ancestor::div[3]');
    this.filtersButton = page.getByRole('button', { name: 'Filters' });
    this.saveFiltersButton = page.getByRole('button', { name: 'Save' });
    this.filterActive = new FilterOption(page, 'Active');
    this.filterClosed = new FilterOption(page, 'Closed');
    this.filterCancelled = new FilterOption(page, 'Cancelled');
    this.carouselsContainer = page.locator('main > div');
    this.eventCarousels = page.locator('main > div > div');
    this.noResultsMsg = page.getByRole('heading', { name: 'No rooming lists found' });
    this.separators = page.locator('div[position="0"]');
    this.bookingsModal = page.getByRole('heading', { name: 'Bookings' }).locator('xpath=ancestor::div[2]');
    this.bookings = this.bookingsModal.locator('> div').nth(1).locator('> div');
    this.bookingsCloseButton = this.bookingsModal.locator(`svg path[d="${CLOSE_SVG_PATH}"]`);
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
      const processedCardTitles = new Set<string>();

      // Helper function to process the cards that are currently visible
      const processVisibleCards = async () => {
        const visibleCards = await carousel.getCardList(); // Now this works correctly!
        for (const card of visibleCards) {
          const title = await card.getTitle();
          if (title && !processedCardTitles.has(title)) {
            await callback(card);
            processedCardTitles.add(title);
          }
        }
      };

      // Keep clicking "Next" as long as the button is visible
      while (await carousel.isNextButtonVisible()) {
        await processVisibleCards();
        await carousel.clickNext();
      }

      // Process the final set of cards on the last page of the carousel
      await processVisibleCards();
    }
  }

  getCardByTitle(title: string): CardComponent {
    const titleLocator = this.page.getByText(title, { exact: true });
    const cardRootLocator = titleLocator.locator('xpath=ancestor::div[3]');
    return new CardComponent(cardRootLocator);
  }

  async getAllCardStatuses(): Promise<string[]> {
    const allStatuses = new Set<string>();

    await this.forEachCard(async (card) => {
      const status = await card.getStatus();
      if (status) {
        allStatuses.add(status);
      }
    });

    return Array.from(allStatuses);
  }

  // Methods for bookings manipulation
  async getModalBookingsCount(): Promise<number> {
    return this.bookings.count();
  }

  async closeBookingsModal(): Promise<void> {
    await this.bookingsCloseButton.click();
  }
}