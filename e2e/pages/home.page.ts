import type { Page, Locator } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly logo: Locator;
  readonly textarea: Locator;
  readonly enterButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.logo = page.getByText('OpenMAIC', { exact: true }).first();
    this.textarea = page.locator('textarea:not([data-slot])');
    this.enterButton = page.getByRole('button', { name: /generate/i });
  }

  async goto() {
    await this.page.goto('/');
  }

  async fillRequirement(text: string) {
    await this.textarea.fill(text);
  }

  async submit() {
    await this.enterButton.click();
  }
}
