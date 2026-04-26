import { redirect } from "next/navigation";

import { getUserSession } from "@/lib/auth/session";

import { loginAction } from "./actions";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getUserSession();

  if (session) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const hasError = params?.error === "invalid_credentials";
  const needsSetup = params?.error === "setup_required";

  return (
    <main className="auth-shell">
      <section className="auth-panel auth-panel-copy">
        <div className="auth-brand-lockup">
          <p className="eyebrow">Kateil</p>
          <h1>Arte en movimiento</h1>
          <p className="auth-brand-tagline">
            Una entrada serena para gestión operativa modular por organización.
          </p>
        </div>

        <div className="auth-copy-card auth-copy-card-brand">
          <p className="card-label">Kateil Platform</p>
          <p className="lede">
            Un acceso privado con presencia editorial y una interfaz limpia para empezar a
            trabajar sin fricción.
          </p>
        </div>

        <div className="auth-illustration" aria-hidden="true">
          <div className="auth-illustration-wash" />
          <div className="auth-figure auth-figure-one">
            <span className="auth-figure-head" />
            <span className="auth-figure-body" />
          </div>
          <div className="auth-figure auth-figure-two">
            <span className="auth-figure-head" />
            <span className="auth-figure-body" />
          </div>
          <div className="auth-figure auth-figure-three">
            <span className="auth-figure-head" />
            <span className="auth-figure-body" />
          </div>
        </div>
      </section>

      <section className="auth-panel auth-panel-form">
        <div className="auth-form-header">
          <p className="card-label">Entrar</p>
          <h2>Cuenta interna</h2>
          <p className="auth-form-copy">Introduce tu email y contraseña.</p>
        </div>

        <form action={loginAction} className="auth-form">
          <label>
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>

          <label>
            <span>Contraseña</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          {hasError ? <p className="form-error">Email o contraseña incorrectos.</p> : null}
          {needsSetup ? (
            <p className="form-error">
              La base aún no está inicializada. Ejecuta migración y seed antes del primer
              acceso.
            </p>
          ) : null}

          <button className="button button-primary auth-submit" type="submit">
            Acceder al panel
          </button>
        </form>

        <p className="auth-note">
          Acceso reservado al equipo interno de Kateil.
        </p>
      </section>
    </main>
  );
}
