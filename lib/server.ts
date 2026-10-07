import {getDb} from "@/db";
import {getOrganizer} from "@/lib/auth";
import {DEFAULT_EVENT,type EventSettings,type Ticket} from "./types";
export class AppError extends Error {constructor(message:string,public status=400){super(message);}}
export function db(){if(!process.env.DATABASE_URL)throw new AppError("Le stockage est momentanément indisponible.",503);return getDb();}
export async function authorize(request?:Request){
 const user=await getOrganizer();if(!user)throw new AppError("Connectez-vous à votre espace organisateur.",401);
 if(request&&request.method!=="GET"){const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)throw new AppError("Requête non autorisée.",403);}
 return user;
}
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export function fail(error:unknown){
 if(error instanceof AppError)return json({error:error.message},error.status);
 if(error&&typeof error==="object"&&"issues" in error)return json({error:"Vérifiez les champs du formulaire."},400);
 console.error("Ticketing request failed",error instanceof Error?error.message:"unknown");return json({error:"L’opération n’a pas abouti. Réessayez."},500);
}
export async function getEvent():Promise<EventSettings>{
 const row=await db().prepare("SELECT * FROM event_settings WHERE id = 'main'").first<Record<string,unknown>>();if(!row)return DEFAULT_EVENT;
 return {name:String(row.name),date:String(row.date),time:String(row.time),departure:String(row.departure),destination:String(row.destination),priceCents:row.price_cents as number|null,capacity:row.capacity as number|null,program:String(row.program),checkpoints:JSON.parse(String(row.checkpoints))};
}
export const ticketColumns='id, reference, name, email, phone, status, amount_cents AS "amountCents", created_at AS "createdAt", paid_at AS "paidAt", cancelled_at AS "cancelledAt", refunded_at AS "refundedAt", sent_at AS "sentAt", email_error AS "emailError"';
export async function getTicket(id:string){const ticket=await db().prepare(`SELECT ${ticketColumns}, token, email_attempt AS "emailAttempt", email_payload AS "emailPayload", email_attempt_at AS "emailAttemptAt" FROM tickets WHERE id = ?`).bind(id).first<Ticket&{token:string;emailAttempt:string|null;emailPayload:string|null;emailAttemptAt:string|null}>();if(!ticket)throw new AppError("Billet introuvable.",404);return ticket;}
export function emailConfig(){return {key:process.env.RESEND_API_KEY,from:process.env.EMAIL_FROM,scriptUrl:process.env.APPS_SCRIPT_WEB_APP_URL,scriptSecret:process.env.APPS_SCRIPT_SHARED_SECRET};}
export function emailReady(){const config=emailConfig();return Boolean((config.scriptUrl&&/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.scriptUrl)&&config.scriptSecret&&config.scriptSecret.length>=32)||(config.key&&config.from));}
export function assertConfigured(event:EventSettings){if(!event.date||event.priceCents===null)throw new AppError("Renseignez la date et le tarif de la sortie dans les paramètres avant de confirmer un paiement.");}
export function token(){return "ODR-"+Array.from(crypto.getRandomValues(new Uint8Array(24)),byte=>byte.toString(16).padStart(2,"0")).join("");}
