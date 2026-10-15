import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { formatCountdown, minutesUntil, remainingSeconds } from "@/lib/time";
import { directionsUrl, telUrl } from "@/lib/maps";
import { errorCode } from "@/lib/errors";
import { dictionaries, dirOf, fmt, isLocale } from "@/lib/i18n";
import { ZONES, zoneName } from "@/lib/zones";
import { haversineKm, nearestZone } from "@/lib/geo";
import { normalizeTnPhone } from "@/lib/phone";
import { LEGAL, LEGAL_KEYS } from "@/content/legal";

describe("compte à rebours", () => {
  it("décompte à partir de la valeur du serveur, sans horloge locale", () => {
    expect(remainingSeconds(60, 1000, 1000)).toBe(60);
    expect(remainingSeconds(60, 1000, 11000)).toBe(50);
    expect(remainingSeconds(60, 1000, 61000)).toBe(0);
    expect(remainingSeconds(60, 1000, 999999)).toBe(0);
  });
  it("formate m:ss", () => {
    expect(formatCountdown(75)).toBe("1:15");
    expect(formatCountdown(5)).toBe("0:05");
    expect(formatCountdown(-3)).toBe("0:00");
  });
  it("calcule les minutes de disponibilité restantes", () => {
    const now = Date.parse("2026-10-13T12:00:00Z");
    expect(minutesUntil("2026-10-13T12:30:00Z", now)).toBe(30);
    expect(minutesUntil("2026-10-13T12:00:10Z", now)).toBe(1);
    expect(minutesUntil("2026-10-13T11:59:00Z", now)).toBe(0);
    expect(minutesUntil(null, now)).toBe(0);
  });
});

describe("liens", () => {
  it("itinéraire par coordonnées, sinon par adresse", () => {
    expect(directionsUrl({ latitude: 36.83, longitude: 10.24, address: "x" })).toContain("destination=36.83%2C10.24");
    expect(directionsUrl({ latitude: null, longitude: null, address: "12 rue du Lac, Tunis" })).toContain(
      encodeURIComponent("12 rue du Lac, Tunis")
    );
  });
  it("nettoie le numéro de téléphone", () => {
    expect(telUrl("+216 20 000-000")).toBe("tel:+21620000000");
  });
});

describe("erreurs", () => {
  it("reconnaît les codes des fonctions SQL et de l'authentification", () => {
    expect(errorCode({ message: "clinic_busy" })).toBe("clinic_busy");
    expect(errorCode({ message: "rate_limited" })).toBe("rate_limited");
    expect(errorCode({ message: "Invalid login credentials" })).toBe("invalid_credentials");
    expect(errorCode({ message: "Token has expired or is invalid" })).toBe("invalid_code");
    expect(errorCode({ message: "Email not confirmed" })).toBe("email_not_confirmed");
    expect(errorCode(new Error("supabase_not_configured"))).toBe("supabase_not_configured");
    expect(errorCode({ message: "registration_used" })).toBe("registration_used");
    expect(errorCode({ message: "invalid_transition" })).toBe("invalid_transition");
    expect(errorCode({ message: "busy" })).toBe("busy");
    expect(errorCode({ message: "For security purposes, you can only request this after 49 seconds." })).toBe("email_rate_limit");
    expect(errorCode({ message: "boom" })).toBe("unknown");
    expect(errorCode(null)).toBe("unknown");
  });
  it("chaque code a un message en français et en arabe", () => {
    for (const l of ["fr", "ar"] as const) {
      const codes = Object.keys(dictionaries[l].errors);
      for (const c of [
        "not_authenticated", "not_a_patient", "not_a_dentist", "not_admin", "invalid_input", "rate_limited",
        "patient_has_active_request", "clinic_unavailable", "clinic_busy", "request_not_found",
        "dentist_not_approved", "dentist_not_found", "supabase_not_configured", "invalid_credentials",
        "invalid_code", "email_rate_limit", "email_not_confirmed", "busy", "invalid_transition",
        "registration_used", "password_mismatch", "unknown",
      ]) {
        expect(codes).toContain(c);
      }
    }
  });
});

describe("langues", () => {
  const keys = (o: unknown, prefix = ""): string[] =>
    typeof o === "object" && o !== null
      ? Object.entries(o).flatMap(([k, v]) => keys(v, `${prefix}${k}.`))
      : [prefix];

  it("le français et l'arabe ont exactement les mêmes clés", () => {
    expect(keys(dictionaries.ar).sort()).toEqual(keys(dictionaries.fr).sort());
  });
  it("aucune traduction vide", () => {
    const empty = (o: unknown): boolean =>
      typeof o === "string" ? o.trim() === "" : typeof o === "object" && o !== null ? Object.values(o).some(empty) : false;
    expect(empty(dictionaries.fr)).toBe(false);
    expect(empty(dictionaries.ar)).toBe(false);
  });
  it("l'arabe s'écrit de droite à gauche, le français par défaut", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("fr")).toBe("ltr");
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("en")).toBe(false);
  });
  it("remplace les variables", () => {
    expect(fmt("Encore {n} min", { n: 5 })).toBe("Encore 5 min");
    expect(fmt("{a} {b}", { a: "x" })).toBe("x {b}");
  });
  it("les textes légaux existent dans les deux langues avec le même nombre de sections", () => {
    for (const k of LEGAL_KEYS) {
      expect(LEGAL[k].fr.sections.length).toBe(LEGAL[k].ar.sections.length);
      expect(LEGAL[k].fr.sections.length).toBeGreaterThan(5);
    }
  });
});

describe("zone pilote", () => {
  it("compte 15 zones et correspond exactement à la base de données", () => {
    expect(ZONES).toHaveLength(15);
    const sql = readFileSync("supabase/migrations/20261013000000_init.sql", "utf8");
    for (const z of ZONES) {
      expect(sql).toContain(`'${z.id}'`);
      expect(sql).toContain(`'${z.fr}'`);
      expect(sql).toContain(`'${z.ar}'`);
    }
    expect(zoneName("la-marsa", "fr")).toBe("La Marsa");
    expect(zoneName("la-marsa", "ar")).toBe("المرسى");
  });
});

describe("géolocalisation (zone uniquement)", () => {
  it("calcule une distance plausible", () => {
    expect(haversineKm(36.835, 10.238, 36.835, 10.238)).toBe(0);
    const d = haversineKm(36.8665, 10.1647, 36.91, 10.3); // Ariana -> Gammarth
    expect(d).toBeGreaterThan(10);
    expect(d).toBeLessThan(15);
  });
  it("trouve la zone pilote la plus proche", () => {
    expect(nearestZone(36.8352, 10.2381)?.id).toBe("lac-1");
    expect(nearestZone(36.8782, 10.3238)?.id).toBe("la-marsa");
  });
  it("renvoie null hors de la zone pilote", () => {
    expect(nearestZone(35.8256, 10.6084)).toBeNull(); // Sousse
    expect(nearestZone(36.8, 10.18, 0.1)).toBeNull();
  });
});

describe("téléphone tunisien", () => {
  it("normalise vers +216XXXXXXXX", () => {
    expect(normalizeTnPhone("71 000 010")).toBe("+21671000010");
    expect(normalizeTnPhone("+216 20-000-000")).toBe("+21620000000");
    expect(normalizeTnPhone("00216 98 123 456")).toBe("+21698123456");
    expect(normalizeTnPhone("216 98 123 456")).toBe("+21698123456");
  });
  it("refuse les numéros invalides", () => {
    expect(normalizeTnPhone("123")).toBeNull();
    expect(normalizeTnPhone("+33 6 12 34 56 78")).toBeNull();
    expect(normalizeTnPhone("")).toBeNull();
  });
});
