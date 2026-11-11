import { json } from "@/lib/auth/request";

export function GET() {
  return json({ status: "ok" });
}
