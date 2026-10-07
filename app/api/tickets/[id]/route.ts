import QRCode from "qrcode";
import {authorize,getTicket,getEvent,AppError,fail} from "@/lib/server";
import {makeTicketPDF} from "@/lib/ticket-pdf";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
 try{
  await authorize();const {id}=await context.params;const ticket=await getTicket(id);
  if(ticket.status!=="paid")throw new AppError("Le billet est disponible uniquement après confirmation du paiement.",403);
  if(new URL(request.url).searchParams.get("format")==="svg"){
   const svg=await QRCode.toString(ticket.token,{type:"svg",errorCorrectionLevel:"M",margin:4,color:{dark:"#173f37",light:"#ffffff"}});
   return new Response(svg,{headers:{"Content-Type":"image/svg+xml","Cache-Control":"no-store"}});
  }
  const pdf=await makeTicketPDF(ticket,await getEvent());
  return new Response(new Uint8Array(pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename="Billet-${ticket.reference}.pdf"`,"Cache-Control":"no-store"}});
 }catch(error){return fail(error);}
}
