import {z} from "zod";
import {authorize,db,getEvent,getTicket,ticketColumns,json,fail,AppError,token,assertConfigured,emailConfig,emailReady} from "@/lib/server";
import {makeTicketPDF} from "@/lib/ticket-pdf";
import {money,eventDate} from "@/lib/types";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const name=z.string().trim().min(2).max(100);
const email=z.string().trim().email().max(254).transform(s=>s.toLowerCase());
const id=z.string().uuid();
const checkpoint=z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),label:z.string().trim().min(1).max(40)});
const settings=z.object({name:z.string().trim().min(2).max(80),date:z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),time:z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/),departure:z.string().trim().min(1).max(100),destination:z.string().trim().min(1).max(100),priceCents:z.number().int().min(0).max(10000000).nullable(),capacity:z.number().int().min(1).max(10000).nullable(),program:z.string().max(1000),checkpoints:z.array(checkpoint).min(1).max(12)});
export async function GET(){
 try{
  const user=await authorize();
  const [event,tickets,checkins]=await Promise.all([getEvent(),db().prepare(`SELECT ${ticketColumns} FROM tickets ORDER BY created_at DESC`).all(),db().prepare('SELECT c.id,c.ticket_id AS "ticketId",c.checkpoint,c.scanned_at AS "scannedAt",t.name,t.reference FROM checkins c JOIN tickets t ON t.id=c.ticket_id ORDER BY c.scanned_at DESC').all()]);
  return json({event,tickets:tickets.results,checkins:checkins.results,emailReady:emailReady(),userName:user.displayName});
 }catch(error){return fail(error);}
}
export async function POST(request:Request){
 try{
  const user=await authorize(request);
  if(Number(request.headers.get("content-length")||"0")>20000)throw new AppError("Requête trop volumineuse.",413);
  const body=z.record(z.unknown()).parse(await request.json());const now=new Date().toISOString();
  if(body.action==="settings"){
   const event=settings.parse(body.event);
   if(event.date&&(Number.isNaN(Date.parse(event.date))||new Date(event.date).toISOString().slice(0,10)!==event.date))throw new AppError("Date invalide.");
   if(!event.checkpoints.some(c=>c.id==="entry"))throw new AppError("Le contrôle principal Entrée doit être conservé.");
   if(new Set(event.checkpoints.map(c=>c.id)).size!==event.checkpoints.length)throw new AppError("Les contrôles doivent avoir des identifiants distincts.");
   const used=await db().prepare("SELECT DISTINCT checkpoint FROM checkins").all<{checkpoint:string}>();
   if(used.results.some(c=>!event.checkpoints.some(e=>e.id===c.checkpoint)))throw new AppError("Un contrôle déjà utilisé ne peut pas être supprimé.");
   const result=await db().prepare("SELECT public.update_event_settings(?,?,?,?,?,?,?,?,?) AS result").bind(event.name,event.date,event.time,event.departure,event.destination,event.priceCents,event.capacity,event.program,JSON.stringify(event.checkpoints)).first<{result:string}>();
   if(result?.result==="too_small")throw new AppError("La capacité ne peut pas être inférieure aux inscriptions actives.");
   if(result?.result!=="saved")throw new AppError("Les paramètres n’ont pas été enregistrés.",500);
   return json({message:"Les informations de la sortie sont enregistrées."});
  }
  if(body.action==="create"){
   const input=z.object({name,email,phone:z.string().trim().max(30).default(""),paid:z.boolean(),requestId:id}).parse(body);
   const event=await getEvent();if(input.paid)assertConfigured(event);
   const reference="OD-"+crypto.randomUUID().replaceAll("-","").slice(0,10).toUpperCase();
   const result=await db().prepare("SELECT public.create_ticket(?,?,?,?,?,?,?,?,?,?,?) AS result").bind(input.requestId,reference,token(),input.name,input.email,input.phone,input.paid?"paid":"pending",event.priceCents,now,input.paid?now:null,input.paid?user.userId:null).first<{result:string}>();
   if(result?.result==="full")throw new AppError("La sortie est complète.",409);
   if(!result||!(["created","existing"].includes(result.result)))throw new AppError("L’inscription n’a pas abouti.",500);
   return json({message:input.paid?"Paiement enregistré. Le billet est prêt.":"Participant inscrit, paiement en attente.",id:input.requestId});
  }
  if(body.action==="pay"){
   const ticketId=id.parse(body.id);const event=await getEvent();assertConfigured(event);
   const result=await db().prepare("UPDATE tickets SET status='paid',paid_at=?,paid_by=?,amount_cents=COALESCE(amount_cents,?) WHERE id=? AND status='pending'").bind(now,user.userId,event.priceCents,ticketId).run();
   if(!result.meta.changes)throw new AppError("Ce paiement est déjà confirmé, ou le billet est annulé.",409);
   return json({message:"Paiement en espèces confirmé. Le billet est prêt."});
  }
  if(body.action==="cancel"){
   const ticketId=id.parse(body.id);await getTicket(ticketId);
   await db().prepare("UPDATE tickets SET status='cancelled',cancelled_at=? WHERE id=? AND status != 'cancelled'").bind(now,ticketId).run();
   return json({message:"Le billet est annulé. Son QR code est désactivé."});
  }
  if(body.action==="refund"){
   const ticketId=id.parse(body.id);
   const result=await db().prepare("UPDATE tickets SET refunded_at=? WHERE id=? AND status='cancelled' AND paid_at IS NOT NULL AND refunded_at IS NULL").bind(now,ticketId).run();
   if(!result.meta.changes)throw new AppError("Aucun remboursement à enregistrer pour ce billet.",409);
   return json({message:"Remboursement en espèces enregistré."});
  }
  if(body.action==="checkin"){
   const input=z.object({code:z.string().trim().min(3).max(256),checkpoint:z.string().max(40)}).parse(body);const event=await getEvent();
   if(!event.checkpoints.some(c=>c.id===input.checkpoint))throw new AppError("Point de contrôle inconnu.");
   const ticket=await db().prepare("SELECT id,name,reference,status FROM tickets WHERE token=? OR reference=?").bind(input.code,input.code.toUpperCase()).first<{id:string;name:string;reference:string;status:string}>();
   if(!ticket)return json({result:"invalid",message:"Billet introuvable. Vérifiez le code."});
   if(ticket.status!=="paid")return json({result:"invalid",message:ticket.status==="cancelled"?"Ce billet a été annulé.":"Paiement non confirmé. Dirigez le participant vers la caisse.",name:ticket.name});
   // One atomic write and UNIQUE(ticket_id, checkpoint) protect concurrent scanners.
   const inserted=await db().prepare("INSERT INTO checkins (id,ticket_id,checkpoint,scanned_at,scanned_by) SELECT ?,id,?,?,? FROM tickets WHERE id=? AND status='paid' ON CONFLICT(ticket_id,checkpoint) DO NOTHING").bind(crypto.randomUUID(),input.checkpoint,now,user.userId,ticket.id).run();
   if(!inserted.meta.changes){
    const old=await db().prepare('SELECT scanned_at AS "scannedAt" FROM checkins WHERE ticket_id=? AND checkpoint=?').bind(ticket.id,input.checkpoint).first<{scannedAt:string}>();
    if(!old)return json({result:"invalid",message:"Ce billet n’est plus valide."});
    return json({result:"duplicate",message:"Billet déjà utilisé à ce point de contrôle.",name:ticket.name,reference:ticket.reference,scannedAt:old.scannedAt});
   }
   return json({result:"accepted",message:"Passage validé. Bonne journée !",name:ticket.name,reference:ticket.reference,scannedAt:now});
  }
  if(body.action==="email"){
   const ticket=await getTicket(id.parse(body.id));if(ticket.status!=="paid")throw new AppError("Seuls les billets payés peuvent être envoyés.");
   const config=emailConfig();if(!emailReady())throw new AppError("L’envoi par email n’est pas encore connecté. Vous pouvez télécharger le billet PDF.",503);
   if(ticket.sentAt)return json({message:"Ce billet a déjà été transmis au service d’email."});
   const event=await getEvent();assertConfigured(event);
   await db().prepare("UPDATE tickets SET email_attempt=COALESCE(email_attempt,?),email_attempt_at=COALESCE(email_attempt_at,?) WHERE id=?").bind(crypto.randomUUID(),now,ticket.id).run();
   let current=await getTicket(ticket.id);
   const pdf=current.emailPayload?null:await makeTicketPDF(current,event);
   const text=`Bonjour ${ticket.name},\n\nVotre paiement en espèces de ${money(ticket.amountCents)} est confirmé. Votre billet pour « ${event.name} » est joint à cet email.\n\n${eventDate(event.date)}${event.time?" à "+event.time:""}\nDépart : ${event.departure}\nDestination : ${event.destination}\n${event.program?"\nProgramme : "+event.program+"\n":""}\nPrésentez le QR code sur votre téléphone ou sur papier. Chaque passage est validé une seule fois par activité.\n\nÀ bientôt,\nL’équipe organisatrice`;
   if(!current.emailPayload){
    const payload=JSON.stringify({provider:config.scriptUrl&&config.scriptSecret?"apps-script":"resend",from:config.from||null,to:[ticket.email],subject:`Votre billet — ${event.name} — ${ticket.reference}`,text,attachments:[{filename:`Billet-${ticket.reference}.pdf`,content:Buffer.from(pdf!).toString("base64"),content_type:"application/pdf"}]});
    await db().prepare("UPDATE tickets SET email_payload=COALESCE(email_payload,?) WHERE id=?").bind(payload,ticket.id).run();
    current=await getTicket(ticket.id);
   }
   const saved=JSON.parse(current.emailPayload!) as {provider?:string;from?:string;to:string[];subject:string;text:string;attachments:{filename:string;content:string;content_type:string}[]};
   const provider=saved.provider||"resend";
   if(provider==="resend" && current.emailAttemptAt && Date.now()-Date.parse(current.emailAttemptAt)>23*60*60*1000)throw new AppError("Cet envoi doit être vérifié dans Resend avant toute nouvelle tentative pour éviter un doublon.",409);
   let response:Response;
   try{
    if(provider==="apps-script"){
     if(!config.scriptUrl||!config.scriptSecret||!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.scriptUrl)||config.scriptSecret.length<32)throw new AppError("Configuration Gmail incomplète. Vérifiez l’URL et le secret du script.",503);
     response=await fetch(config.scriptUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret:config.scriptSecret,idempotencyKey:`ticket-${ticket.id}-${current.emailAttempt}`,to:saved.to[0],subject:saved.subject,text:saved.text,filename:saved.attachments[0].filename,pdfBase64:saved.attachments[0].content}),signal:AbortSignal.timeout(30000)});
    }else{
     if(!config.key||!saved.from)throw new AppError("La configuration Resend utilisée pour ce billet n’est plus disponible.",503);
     response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${config.key}`,"Content-Type":"application/json","Idempotency-Key":`ticket-${ticket.id}-${current.emailAttempt}`},body:JSON.stringify({from:saved.from,to:saved.to,subject:saved.subject,text:saved.text,attachments:saved.attachments}),signal:AbortSignal.timeout(20000)});
    }
   }catch(error){if(error instanceof AppError)throw error;await db().prepare("UPDATE tickets SET email_error=? WHERE id=?").bind("Réponse du service indisponible. Vérifiez l’envoi avant toute nouvelle tentative.",ticket.id).run();throw new AppError("Le service d’email n’a pas répondu. Vérifiez l’envoi avant de réessayer.",502);}
   let result:{id?:string;ok?:boolean;error?:string};try{result=await response.json() as typeof result;}catch{throw new AppError("Réponse du service d’email invalide. Vérifiez la boîte des messages envoyés avant de réessayer.",502);}
   if(provider==="apps-script" && (result.ok!==true||result.id!==`ticket-${ticket.id}-${current.emailAttempt}`))throw new AppError(result.error||"Le script Gmail n’a pas confirmé l’envoi. Vérifiez sa configuration.",502);
   if(!response.ok||!result.id){await db().prepare("UPDATE tickets SET email_error=? WHERE id=?").bind("L’envoi a échoué. Vérifiez la configuration de l’expéditeur.",ticket.id).run();throw new AppError("L’envoi a échoué. Vérifiez l’adresse expéditrice et la configuration du service d’email.",502);}
   await db().prepare("UPDATE tickets SET sent_at=?,email_id=?,email_error=NULL WHERE id=?").bind(now,result.id,ticket.id).run();
   return json({message:"Billet transmis au service d’email. La réception dépend du destinataire."});
  }
  throw new AppError("Action inconnue.");
 }catch(error){return fail(error);}
}
