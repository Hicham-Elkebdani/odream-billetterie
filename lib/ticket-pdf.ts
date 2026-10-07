import {PDFDocument,rgb,type PDFFont} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {FONT_DATA} from "./font-data";
import {type Ticket,type EventSettings,eventDate,money} from "./types";
type Color=ReturnType<typeof rgb>;
export async function makeTicketPDF(ticket:Ticket&{token:string},event:EventSettings){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(Buffer.from(FONT_DATA,"base64"),{subset:true});
 // Brush font (Permanent Marker, Apache 2.0) used for the poster-style title and "SCAN ME".
 const markerBytes=await readFile(join(process.cwd(),"public","fonts","PermanentMarker-Regular.ttf"));
 const marker=await pdf.embedFont(markerBytes,{subset:true});
 const markerGlyphs=fontkit.create(markerBytes);
 const page=pdf.addPage([440,700]);
 // Palette: AEI royal blue / navy, poster orange-red, cream paper.
 const blue=rgb(.090,.322,.627),navy=rgb(.055,.184,.400),orangeRed=rgb(.84,.29,.11),orangeDark=rgb(.80,.38,.11);
 const blueSoft=rgb(.882,.922,.973),muted=rgb(.42,.48,.58),paper=rgb(.992,.973,.937),white=rgb(1,1,1),ink=rgb(.035,.07,.16);
 const fit=(value:string,f:PDFFont,size:number,max:number)=>{let actual=size;while(f.widthOfTextAtSize(value,actual)>max&&actual>7)actual-=.5;return actual;};
 const text=(value:string,x:number,y:number,size=11,color:Color=navy,max=360,f:PDFFont=font,opacity=1)=>{
  page.drawText(value,{x,y,size:fit(value,f,size,max),font:f,color,opacity});
 };
 const bold=(value:string,x:number,y:number,size=11,color:Color=navy,max=360)=>{text(value,x,y,size,color,max);text(value,x+.45,y,size,color,max);};
 const centered=(value:string,cx:number,y:number,size:number,color:Color=navy,max=400,f:PDFFont=font,strong=false)=>{
  const actual=fit(value,f,size,max),x=cx-f.widthOfTextAtSize(value,actual)/2;
  page.drawText(value,{x,y,size:actual,font:f,color});if(strong)page.drawText(value,{x:x+.45,y,size:actual,font:f,color});
 };
 const box=(x:number,y:number,w:number,h:number,r:number,options:{color?:Color;borderColor?:Color;borderWidth?:number;opacity?:number})=>
  page.drawSvgPath(`M ${r} 0 H ${w-r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h-r} A ${r} ${r} 0 0 1 ${w-r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h-r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`,{x,y:y+h,...options});
 // Deterministic pseudo-random generator so every ticket gets the same texture.
 let seed=0x2f6b1d;
 const rnd=()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 page.drawRectangle({x:0,y:0,width:440,height:700,color:paper});
 // Header: horizontal gradient orange-red → navy.
 const headerBottom=470,bands=60;
 for(let i=0;i<bands;i++){const t=i/(bands-1);page.drawRectangle({x:440*i/bands,y:headerBottom,width:440/bands+.6,height:700-headerBottom,color:rgb(.84+(.07-.84)*t,.29+(.16-.29)*t,.11+(.36-.11)*t)});}
 // Grunge texture: light scratches and specks over the whole header.
 for(let i=0;i<180;i++)page.drawCircle({x:rnd()*440,y:headerBottom+8+rnd()*(692-headerBottom),size:.4+rnd()*1.8,color:ink,opacity:.25+rnd()*.3});
 for(let i=0;i<14;i++){const x=rnd()*440,y=headerBottom+10+rnd()*210,len=30+rnd()*90,a=-.4+rnd()*.8;page.drawLine({start:{x,y},end:{x:x+Math.cos(a)*len,y:Math.min(696,Math.max(headerBottom+6,y+Math.sin(a)*len))},thickness:.3+rnd()*.9,color:ink,opacity:.25});}
 // Paint splatter behind the title.
 const blob=(cx:number,cy:number,rx:number,ry:number)=>{
  for(let i=0;i<38;i++){const a=rnd()*Math.PI*2,d=Math.sqrt(rnd())*.75;page.drawCircle({x:cx+Math.cos(a)*rx*d,y:cy+Math.sin(a)*ry*d,size:10+rnd()*22,color:ink,opacity:.9});}
  for(let i=0;i<160;i++){const a=rnd()*Math.PI*2,d=.7+rnd()*.75,x=cx+Math.cos(a)*rx*d,y=cy+Math.sin(a)*ry*d;if(y<headerBottom+10||y>696)continue;page.drawCircle({x,y,size:.6+rnd()*3.4,color:ink,opacity:.85});}
  for(let i=0;i<14;i++){const a=rnd()*Math.PI*2,r2=1+rnd()*.6;page.drawLine({start:{x:cx+Math.cos(a)*rx*.6,y:cy+Math.sin(a)*ry*.6},end:{x:cx+Math.cos(a)*rx*r2,y:Math.min(696,Math.max(headerBottom+12,cy+Math.sin(a)*ry*r2))},thickness:.8+rnd()*2.2,color:ink,opacity:.85});}
 };
 blob(150,612,125,68);
 // Torn-paper bottom edge of the header.
 let edge=`M 0 ${700-headerBottom}`;for(let x=0;x<=440;x+=8)edge+=` L ${x} ${700-headerBottom-4+rnd()*8}`;edge+=` L 440 700 L 0 700 Z`;
 page.drawSvgPath(edge,{x:0,y:700,color:paper});
 // Poster title (brush font) with soft shadow; falls back to the regular font for unsupported characters.
 const titleRaw=event.name.toUpperCase().replace(/[’‘]/g,"'");
 const titleFont=[...titleRaw].every(c=>/\s/.test(c)||markerGlyphs.hasGlyphForCodePoint(c.codePointAt(0)!))?marker:font;
 let titleSize=46,titleLines=wrap(titleRaw,titleFont,titleSize,250);
 while((titleLines.length>2||titleLines.some(l=>titleFont.widthOfTextAtSize(l,titleSize)>250))&&titleSize>18){titleSize-=2;titleLines=wrap(titleRaw,titleFont,titleSize,250);}
 const lineHeight=titleSize*1.02;let baseline=(titleLines.length>1?672:650)-titleSize*.8;
 for(const line of titleLines.slice(0,2)){
  text(line,30,baseline-2,titleSize,ink,250,titleFont,.55);
  text(line,28,baseline,titleSize,white,250,titleFont);
  baseline-=lineHeight;
 }
 text("O’Dream Beach",30,baseline+lineHeight-titleSize*.3-22,12,white,250);
 text(`${event.departure} → ${event.destination}`,30,baseline+lineHeight-titleSize*.3-38,9.5,rgb(1,.86,.76),250);
 // Logo card (unchanged AEI logo): the PNG is transparent; its visible artwork spans x 18–84 % and y 25–75 % of the image.
 const logo=await pdf.embedPng(await readFile(join(process.cwd(),"public","aei.png")));
 const card={x:298,y:578,w:118,h:100};
 box(card.x,card.y,card.w,card.h,12,{color:white});
 const logoSize=(card.w-16)/.663,cx=card.x+card.w/2,cy=card.y+card.h/2;
 page.drawImage(logo,{x:cx-.5115*logoSize,y:cy-.5005*logoSize,width:logoSize,height:logoSize});
 // Participant name on a white brush stroke.
 const bw=372,bh=50,bx=34,btop=496;
 let stroke=`M 10 ${2+rnd()*3}`;
 for(let x=24;x<bw-10;x+=14)stroke+=` L ${x} ${rnd()*4}`;
 stroke+=` L ${bw-4} 6 L ${bw-12} 14 L ${bw+6} 22 L ${bw-6} 31 L ${bw+2} 40 L ${bw-10} ${bh-1}`;
 for(let x=bw-24;x>10;x-=14)stroke+=` L ${x} ${bh-rnd()*4}`;
 stroke+=` L 4 ${bh-3} L 12 40 L -6 32 L 6 24 L -4 15 L 8 8 Z`;
 page.drawSvgPath(stroke,{x:bx,y:btop,color:white});
 for(let i=0;i<6;i++){const y=btop-8-rnd()*(bh-16);page.drawLine({start:{x:bx+bw-8,y},end:{x:bx+bw+10+rnd()*16,y:y+rnd()*2-1},thickness:1+rnd()*1.5,color:white,opacity:.9});page.drawLine({start:{x:bx+8,y:y-3},end:{x:bx-10-rnd()*14,y:y-3+rnd()*2-1},thickness:1+rnd()*1.5,color:white,opacity:.9});}
 centered(ticket.name,220,btop-bh/2-8,22,rgb(.07,.07,.1),320,font,true);
 // Details grid.
 const field=(label:string,value:string,x:number,y:number,valueColor:Color=navy)=>{box(x,y,182,52,10,{color:blueSoft});centered(label,x+91,y+32,8.5,navy,166,font,true);centered(value,x+91,y+12,12.5,valueColor,166);};
 field("DATE",eventDate(event.date),32,368);
 field("HEURE DE DÉPART",event.time||"À confirmer",226,368);
 field("PAIEMENT CONFIRMÉ",money(ticket.amountCents),32,306,orangeDark);
 field("BILLET NOMINATIF",ticket.reference,226,306,blue);
 // Tear-off line with navy notches.
 page.drawLine({start:{x:28,y:282},end:{x:412,y:282},thickness:2.2,color:navy,dashArray:[10,7]});
 page.drawCircle({x:0,y:282,size:15,color:navy});page.drawCircle({x:440,y:282,size:15,color:navy});
 // QR code framed by corner brackets with "SCAN ME / HERE".
 const qx=52,qy=108,qs=140,m=12,bl=26,bt=4.5;
 box(qx,qy,qs,qs,6,{color:white});
 const code=QRCode.create(ticket.token,{errorCorrectionLevel:"M"});const size=code.modules.size;const scale=qs/(size+8);
 for(let row=0;row<size;row++)for(let col=0;col<size;col++)if(code.modules.get(row,col))page.drawRectangle({x:qx+(col+4)*scale,y:qy+(size-row+3)*scale,width:scale+.01,height:scale+.01,color:navy});
 const L=qx-m,R=qx+qs+m,B=qy-m,T=qy+qs+m;
 for(const [x,y,dx,dy] of [[L,T,1,-1],[R,T,-1,-1],[L,B,1,1],[R,B,-1,1]]){
  page.drawRectangle({x:dx>0?x-bt/2:x-bl+bt/2,y:y-bt/2,width:bl,height:bt,color:navy});
  page.drawRectangle({x:x-bt/2,y:dy>0?y-bt/2:y-bl+bt/2,width:bt,height:bl,color:navy});
 }
 centered("SCAN ME",qx+qs/2,T-6,17,navy,100,marker);
 centered("HERE",qx+qs/2,B-6,17,navy,100,marker);
 // Included package.
 bold("FORMULE INCLUSE",236,246,11,navy,175);
 const drawItem=(y:number,title:string,subtitle?:string)=>{
  box(233.5,y-2,176,44,9,{color:rgb(.86,.83,.78),opacity:.6});
  box(232,y,176,44,9,{color:orangeRed});
  box(237,y,171,44,9,{color:white});
  if(subtitle){centered(title,322,y+24,12.5,navy,150,font,true);centered(subtitle,322,y+10,7.5,muted,150);}
  else centered(title,322,y+17,12.5,navy,150,font,true);
 };
 drawItem(182,"Transport A/R",`Trajet ${event.departure} ⇄ ${event.destination}`);
 drawItem(124,"Restauration");
 // Footer with socials.
 page.drawRectangle({x:0,y:0,width:440,height:58,color:navy});
 page.drawRectangle({x:0,y:58,width:440,height:3.5,color:orangeRed});
 centered("Un passage par point de contrôle. Conservez ce billet.",220,39,8.5,rgb(.80,.86,.95),400);
 box(32,11,14,14,4,{borderColor:white,borderWidth:1.3});
 page.drawCircle({x:39,y:18,size:3.2,borderColor:white,borderWidth:1.3});
 page.drawCircle({x:42.6,y:21.6,size:.8,color:white});
 text("a.e.i_eniadb",52,14,9,white,90);
 box(140,11,14,14,2.5,{color:white});
 bold("in",143,14.5,8.5,navy,12);
 text("Association des Étudiants Ingénieurs ENIADB",160,14,9,white,250);
 pdf.setCreationDate(new Date(ticket.createdAt));pdf.setModificationDate(new Date(ticket.paidAt||ticket.createdAt));
 pdf.setTitle(`${event.name} — ${ticket.reference}`);pdf.setAuthor("AEI · O’Dream Beach");
 return pdf.save();
}
function wrap(value:string,font:PDFFont,size:number,width:number){
 const lines:string[]=[];for(const paragraph of value.split("\n")){let current="";for(const word of paragraph.split(/\s+/)){const next=current?current+" "+word:word;if(font.widthOfTextAtSize(next,size)>width&&current){lines.push(current);current=word;}else current=next;}if(current)lines.push(current);}return lines;
}
