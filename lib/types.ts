export type Checkpoint = { id: string; label: string };
export type EventSettings = {name:string;date:string;time:string;departure:string;destination:string;priceCents:number|null;capacity:number|null;program:string;checkpoints:Checkpoint[]};
export type Ticket = {id:string;reference:string;name:string;email:string;phone:string;status:"pending"|"paid"|"cancelled";amountCents:number|null;createdAt:string;paidAt:string|null;cancelledAt:string|null;refundedAt:string|null;sentAt:string|null;emailError:string|null};
export type Checkin = {id:string;ticketId:string;checkpoint:string;scannedAt:string;name:string;reference:string};
export type Data = {event:EventSettings;tickets:Ticket[];checkins:Checkin[];emailReady:boolean;userName:string};
export const DEFAULT_EVENT:EventSettings = {name:"Journée d’intégration",date:"",time:"",departure:"ENIAD BERKANE",destination:"Saïdia",priceCents:null,capacity:null,program:"Football · Volley-ball · Jeux de plage",checkpoints:[{id:"entry",label:"Entrée"},{id:"football",label:"Football"},{id:"volleyball",label:"Volley-ball"}]};
export function money(cents:number|null) {return cents===null?"À définir":new Intl.NumberFormat("fr-MA",{maximumFractionDigits:2}).format(cents/100)+" DH";}
export function eventDate(value:string) {return value?new Intl.DateTimeFormat("fr-FR",{day:"numeric",month:"long",year:"numeric"}).format(new Date(value+"T12:00:00")):"Date à définir";}
export function clock(value:string) {return new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"Africa/Casablanca"}).format(new Date(value));}
