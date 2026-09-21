import { describe, expect, it } from "vitest";

import { ADMIN_OVERVIEW_MODULES } from "./admin-overview-modules";

describe("ADMIN_OVERVIEW_MODULES", () => {
  it("surfaces the four admin modules with Dutch labels and existing routes", () => {
    expect(ADMIN_OVERVIEW_MODULES.map((module) => [module.to, module.label, module.desc])).toEqual([
      ["/customers", "Klanten", "Geregistreerd en gastkopers"],
      ["/users", "Gebruikers", "Wie er in het beheer"],
      ["/products", "Producten", "Uw catalogus"],
      ["/settings", "Instellingen", "Algemeen en voorkeuren"],
    ]);
  });
});
