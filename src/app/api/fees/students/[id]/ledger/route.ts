import { ledgerPdf, pdfResponse } from "@/lib/fee-pdf";
import { getFeesAccess, loadLedger } from "@/lib/fees";

/** A student's fee ledger as a PDF file. Fees staff and admins of the student's school only. */
export async function GET(request: Request, ctx: RouteContext<"/api/fees/students/[id]/ledger">) {
  const { id } = await ctx.params;
  const { school } = await getFeesAccess();
  const ledger = await loadLedger(school.id, id);
  if (!ledger) return new Response("Not found", { status: 404 });
  return pdfResponse(await ledgerPdf(ledger, school), new URL(request.url).searchParams.has("inline"));
}
