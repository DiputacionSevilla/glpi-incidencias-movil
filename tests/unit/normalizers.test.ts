import { describe, expect, it, vi } from "vitest";
import { ageLabel, htmlToText, normalizeFollowup, normalizeSummary } from "@/lib/glpi/normalizers";
import type { SearchMap } from "@/lib/glpi/search-options";

const map: SearchMap = {
  id: "2",
  title: "1",
  priority: "3",
  requester: "4",
  technician: "5",
  status: "12",
  opened: "15",
  updated: "19",
  location: "83",
};

describe("normalizers", () => {
  it("converts untrusted HTML to plain text", () => {
    expect(htmlToText('<p>Hola<br><img src=x onerror="alert(1)">mundo &amp; mas</p>')).toBe(
      "Hola\nmundo & mas",
    );
  });

  it("decodes GLPI numeric entities before stripping encoded markup", () => {
    expect(
      htmlToText(
        '&#60;p style="font-weight: 400;"&#62;&#60;strong&#62;Hola&#60;/strong&#62;&#60;/p&#62;&#60;p&#62;Mundo &amp;amp; mas&#60;/p&#62;',
      ),
    ).toBe("Hola\nMundo & mas");
  });

  it("normalizes a legacy search row", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-05T12:00:00Z"));
    const result = normalizeSummary(
      {
        1: "Impresora",
        2: 8,
        3: 4,
        4: "Persona",
        12: 2,
        15: "2026-08-03 12:00:00",
        19: "2026-08-04 12:00:00",
        83: "Edificio",
      },
      map,
    );
    expect(result).toMatchObject({
      id: 8,
      status: "processing",
      priority: "high",
      ageLabel: "Abierta hace 2 dias",
    });
    vi.useRealTimers();
  });

  it("sorts and strips followup content", () => {
    expect(
      normalizeFollowup(
        { id: 1, date: "2026-01-01 10:00:00", content: "<script>x</script>texto", is_private: 1 },
        "Tecnico",
      ),
    ).toMatchObject({ contentText: "xtexto", isPrivate: true });
  });

  it("uses singular and same-day age labels", () => {
    expect(ageLabel("2026-08-04T12:00:00Z", new Date("2026-08-05T12:00:00Z"))).toBe(
      "Abierta hace 1 dia",
    );
    expect(ageLabel("2026-08-05T08:00:00Z", new Date("2026-08-05T12:00:00Z"))).toBe("Abierta hoy");
  });
});
