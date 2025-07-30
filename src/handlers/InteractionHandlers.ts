import { Collection } from "discord.js";
import fs from "fs/promises";
import path from "path";

export default class InteractionHandlers {
  public modals = new Collection<string, any>();
  public buttons = new Collection<string | RegExp, any>();
  public menus = new Collection<string, any>();

  constructor(
    private modalsDir: string,
    private buttonsDir: string,
    private menusDir: string
  ) { }

  async loadAll() {
    await this.loadModals();
    await this.loadButtons();
    await this.loadMenus();
  }

  private async loadModals() {
    const files = await this.getAllFiles(this.modalsDir);
    for (const file of files) {
      const module = await import(file);
      const modal = module.default;
      if (modal && modal.customId && typeof modal.run === "function") {
        this.modals.set(modal.customId, modal);
      }
    }
  }

  private async loadButtons() {
    const files = await this.getAllFiles(this.buttonsDir);
    for (const file of files) {
      const module = await import(file);
      const button = module.default;
      if (button && button.customId && typeof button.run === "function") {
        // Если customId — RegExp, сохраняем как RegExp, иначе string
        if (button.customId instanceof RegExp) {
          this.buttons.set(button.customId, button);
        } else {
          this.buttons.set(button.customId, button);
        }
      }
    }
  }

  private async loadMenus() {
    const files = await this.getAllFiles(this.menusDir);
    for (const file of files) {
      const module = await import(file);
      const menu = module.default;
      if (menu && menu.customId && typeof menu.run === "function") {
        this.menus.set(menu.customId, menu);
      }
    }
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    let results: string[] = [];
    const list = await fs.readdir(dir, { withFileTypes: true });
    for (const file of list) {
      const filePath = path.join(dir, file.name);
      if (file.isDirectory()) {
        results = results.concat(await this.getAllFiles(filePath));
      } else if (file.name.endsWith(".ts") || file.name.endsWith(".js")) {
        results.push(filePath);
      }
    }
    return results;
  }

  getModal(customId: string) {
    return this.modals.get(customId);
  }
  getButton(customId: string) {
    // Сначала ищем по точному совпадению
    if (this.buttons.has(customId)) return this.buttons.get(customId);
    // Затем ищем по RegExp
    for (const [key, handler] of this.buttons.entries()) {
      if (key instanceof RegExp && key.test(customId)) {
        return handler;
      }
    }
    return undefined;
  }
  getMenu(customId: string) {
    return this.menus.get(customId);
  }
}
