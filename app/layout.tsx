import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"O’Dream Beach · Billetterie organisateur",description:"Votre journée d’intégration, simplement organisée. Participants, paiements en espèces et billets QR.",icons:{icon:"/aei.png"},robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>;}
