import Dashboard from "./dashboard";
import {requireOrganizer} from "@/lib/auth";
export const dynamic="force-dynamic";
export default async function Page(){await requireOrganizer();return <Dashboard/>;}
