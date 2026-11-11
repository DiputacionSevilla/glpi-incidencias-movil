import { describe, expect, it } from "vitest";
import { followupSchema, ticketIdSchema } from "@/lib/validation/schemas";
import { joinTranscript, newTranscriptSegment } from "@/components/useSpeechRecognition";

describe("input validation and speech", () => {
  it("rejects empty, oversized, private, and invalid ticket input", () => {
    expect(followupSchema.safeParse({ content: "   ", isPrivate: false }).success).toBe(false);
    expect(followupSchema.safeParse({ content: "a".repeat(8001), isPrivate: false }).success).toBe(
      false,
    );
    expect(followupSchema.safeParse({ content: "texto", isPrivate: true }).success).toBe(false);
    expect(ticketIdSchema.safeParse("-1").success).toBe(false);
  });

  it("appends final speech segments without overwriting typed text", () => {
    expect(joinTranscript("Texto escrito", "  continuacion ")).toBe("Texto escrito continuacion");
    expect(joinTranscript("", " hola ")).toBe("hola");
  });

  it("ignores repeated mobile results and extracts only cumulative additions", () => {
    expect(newTranscriptSegment("hola", "hola", "hola")).toBe("");
    expect(newTranscriptSegment("hola", "hola", "hola mundo")).toBe("mundo");
    expect(newTranscriptSegment("hola", "", "hola mundo")).toBe("mundo");
    expect(newTranscriptSegment("hola mundo", "", "mundo")).toBe("");
    expect(newTranscriptSegment("hola", "", "frase nueva")).toBe("frase nueva");
  });
});
