import type { DeviceMod } from './mod-api';

class ModRegistry {
  private mods = new Map<string, DeviceMod>();

  register(mod: DeviceMod) {
    if (this.mods.has(mod.id)) {
      console.warn('Мод уже зарегистрирован: ' + mod.id);
    }
    this.mods.set(mod.id, mod);
  }

  get(id: string): DeviceMod | undefined {
    return this.mods.get(id);
  }

  all(): DeviceMod[] {
    return Array.from(this.mods.values());
  }

  has(id: string): boolean {
    return this.mods.has(id);
  }
}

export const registry = new ModRegistry();
