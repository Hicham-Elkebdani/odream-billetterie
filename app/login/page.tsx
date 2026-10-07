import Image from "next/image";
import { redirect } from "next/navigation";
import { getOrganizer } from "@/lib/auth";
import { signIn } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getOrganizer()) redirect("/");
  const { error } = await searchParams;
  const message = error === "missing" ? "Saisissez votre email et votre mot de passe."
    : error === "access" ? "Ce compte n’a pas accès à l’espace organisateur."
    : error ? "Email ou mot de passe incorrect." : null;
  return <main className="login-screen">
    <section className="login-card">
      <Image src="/aei.png" alt="Association des Étudiants Ingénieurs ENIADB" width={95} height={95} className="login-logo" priority />
      <div className="login-eyebrow">ESPACE ORGANISATEUR</div>
      <h1>O’Dream Beach</h1>
      <p>Connectez-vous pour gérer les inscriptions, les billets et les activités de la journée.</p>
      {message && <div className="login-error" role="alert">{message}</div>}
      <form action={signIn}>
        <label className="field">Adresse email<input type="email" name="email" autoComplete="username" required defaultValue="hichamelkebdani123@gmail.com" /></label>
        <label className="field">Mot de passe<input type="password" name="password" autoComplete="current-password" required /></label>
        <button className="button primary" type="submit">Se connecter</button>
      </form>
    </section>
  </main>;
}
