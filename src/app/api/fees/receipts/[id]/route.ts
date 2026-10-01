import { pdfResponse, receiptPdf } from "@/lib/fee-pdf";
import { getFeesAccess } from "@/lib/fees";

/** A fee receipt as a PDF file. Fees staff and admins of the receipt's school only. */
export async function GET(request: Request, ctx: RouteContext<"/api/fees/receipts/[id]">) {
  const { id } = await ctx.params;
  const { school } = await getFeesAccess();
  const pdf = await receiptPdf(school.id, id);
  if (!pdf) return new Response("Not found", { status: 404 });
  return pdfResponse(pdf, new URL(request.url).searchParams.has("inline"));
}
