import { describe, it, expect } from "vitest";
import {
  PROVIDERS,
  getProvidersByType,
  getProviderInfo,
  isValidCompanyId,
  getScraperMaxDays,
} from "../../src/types/provider.js";

describe("provider metadata and types", () => {
  it("includes otsarHahayal in PROVIDERS map", () => {
    expect(PROVIDERS.otsarHahayal).toBeDefined();
    expect(PROVIDERS.otsarHahayal.companyId).toBe("otsarHahayal");
    expect(PROVIDERS.otsarHahayal.displayName).toBe("Bank Otsar Hahayal");
    expect(PROVIDERS.otsarHahayal.type).toBe("bank");
    expect(PROVIDERS.otsarHahayal.loginFields).toEqual(["username", "password"]);
  });

  it("includes otsarHahayal in bank providers list", () => {
    const bankProviders = getProvidersByType("bank");
    const found = bankProviders.find((p) => p.companyId === "otsarHahayal");
    expect(found).toBeDefined();
    expect(found?.displayName).toBe("Bank Otsar Hahayal");
  });

  it("validates otsarHahayal as a valid company ID", () => {
    expect(isValidCompanyId("otsarHahayal")).toBe(true);
  });

  it("retrieves provider info for otsarHahayal", () => {
    const info = getProviderInfo("otsarHahayal");
    expect(info).toBeDefined();
    expect(info?.companyId).toBe("otsarHahayal");
  });

  it("returns scraper max days for otsarHahayal", () => {
    expect(getScraperMaxDays("otsarHahayal")).toBe(365);
  });
});
