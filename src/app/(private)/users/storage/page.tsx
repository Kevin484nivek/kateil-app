import Link from "next/link";

import { ActionForm } from "@/components/ui/action-form";
import { getUserSession } from "@/lib/auth/session";
import { canEditUsers, getRoleLabel } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { hasGoogleDriveOAuthConfig } from "@/lib/storage/google-drive";
import {
  getStorageFolderLabel,
  getStorageProviderLabel,
  getStorageStatusLabel,
  STORAGE_FOLDER_BLUEPRINTS,
} from "@/lib/storage/settings";
import { formatMadridDateTime } from "@/lib/utils/datetime";

import {
  resetStorageSettingsAction,
  saveStorageSettingsAction,
  validateGoogleDriveAction,
} from "./actions";

type UserStorageSettingsPageProps = {
  searchParams?: Promise<{
    connected?: string;
    error?: string;
    reset?: string;
    saved?: string;
    validated?: string;
  }>;
};

export default async function UserStorageSettingsPage({
  searchParams,
}: UserStorageSettingsPageProps) {
  const session = await getUserSession();

  if (!session) {
    return null;
  }

  const [currentUser, integration] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
    }),
    prisma.storageIntegrationSetting.findFirst({
      include: {
        folders: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!currentUser || !canEditUsers(currentUser.role)) {
    return null;
  }

  const params = (await searchParams) ?? {};
  const oauthReady = hasGoogleDriveOAuthConfig();
  const configuredFolders = STORAGE_FOLDER_BLUEPRINTS.map((blueprint) => {
    const existing = integration?.folders.find((folder) => folder.folderType === blueprint.type);

    return {
      ...blueprint,
      folderName: existing?.folderName ?? blueprint.defaultName,
      status: existing?.status ?? "NOT_CONNECTED",
      lastCheckedAt: existing?.lastCheckedAt ?? null,
    };
  });

  const readyFolderCount = configuredFolders.filter(
    (folder) => folder.status === "CONNECTED" || folder.status === "PENDING",
  ).length;

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Usuarios</p>
          <h1>Almacenamiento</h1>
          <p className="lede">
            Conecta Google Drive, define la carpeta raíz y deja preparada la estructura para backups y adjuntos sin tener que rellenar subcarpetas manualmente.
          </p>
        </div>
        <div className="module-chip-row">
          <Link href="/users" className="button button-secondary">
            Volver a usuarios
          </Link>
          {oauthReady ? (
            <Link href="/api/storage/google-drive/connect" className="button button-primary">
              {integration?.oauthRefreshToken ? "Reconectar y validar Drive" : "Conectar Google Drive"}
            </Link>
          ) : (
            <span
              className="button button-secondary button-disabled"
              aria-disabled="true"
              title="Falta completar la configuración OAuth en el servidor"
            >
              Conectar Google Drive
            </span>
          )}
          <span className="module-meta">{getRoleLabel(currentUser.role)}</span>
        </div>
      </div>

      {params.connected ? (
        <article className="panel panel-success">
          <p className="card-label">Conexión preparada</p>
          <p>Google Drive ha devuelto autorización y la cuenta ya queda enlazada. No se envía un correo: la validación se hace al pulsar el botón de conexión.</p>
        </article>
      ) : null}

      {params.saved ? (
        <article className="panel panel-success">
          <p className="card-label">Configuración guardada</p>
          <p>
            La carpeta raíz y las notas ya se han guardado. Este paso no abre Google ni envía correo: la conexión real se lanza desde el botón <strong>Conectar Google Drive</strong>.
          </p>
        </article>
      ) : null}

      {params.validated ? (
        <article className="panel panel-success">
          <p className="card-label">Google Drive validado</p>
          <p>
            Se ha verificado la carpeta raíz y se han actualizado las subcarpetas de
            backups y adjuntos.
          </p>
        </article>
      ) : null}

      {params.reset ? (
        <article className="panel panel-success">
          <p className="card-label">Configuración limpiada</p>
          <p>Se ha eliminado la configuración local de almacenamiento y la app vuelve a quedar sin conexión preparada.</p>
        </article>
      ) : null}

      {params.error ? (
        <article className="panel panel-accent">
          <p className="card-label">Incidencia de conexión</p>
          <p>{params.error}</p>
        </article>
      ) : null}

      {!oauthReady ? (
        <article className="panel panel-accent">
          <p className="card-label">OAuth pendiente en servidor</p>
          <p>
            Guardar esta pantalla solo prepara la raíz y la estructura interna. La ventana de Google aparecerá cuando la configuración OAuth quede completada en el servidor.
          </p>
        </article>
      ) : null}

      <div className="dashboard-kpi-grid">
        <article className="metric-card">
          <p className="card-label">Proveedor</p>
          <strong>
            {integration ? getStorageProviderLabel(integration.provider) : "Google Drive"}
          </strong>
        </article>
        <article className="metric-card metric-card-soft">
          <p className="card-label">Estado</p>
          <strong>
            {integration ? getStorageStatusLabel(integration.status) : "Sin conectar"}
          </strong>
        </article>
        <article className="metric-card">
          <p className="card-label">Carpetas preparadas</p>
          <strong>
            {readyFolderCount}/{configuredFolders.length}
          </strong>
        </article>
        <article className="metric-card metric-card-soft">
          <p className="card-label">Última validación</p>
          <strong>
            {integration?.lastValidatedAt
              ? formatMadridDateTime(integration.lastValidatedAt)
              : "Pendiente"}
          </strong>
        </article>
        <article className="metric-card">
          <p className="card-label">OAuth app</p>
          <strong>{oauthReady ? "Lista" : "Pendiente"}</strong>
        </article>
        <article className="metric-card metric-card-soft">
          <p className="card-label">Cuenta enlazada</p>
          <strong className="storage-linked-email">{integration?.connectedAccountEmail ?? "Pendiente"}</strong>
        </article>
      </div>

      <div className="module-grid">
        <article className="panel">
          <div className="module-list-header">
            <div>
              <p className="card-label">Configuración principal</p>
              <p>
                Aquí solo hace falta indicar la carpeta raíz. Guardar no abre Google: solo deja lista la configuración base para validar permisos y preparar las subcarpetas cuando conectes Drive.
              </p>
            </div>
            <span className="module-meta">
              {oauthReady ? "Listo para conectar Drive" : "OAuth pendiente en servidor"}
            </span>
          </div>

          <ActionForm action={saveStorageSettingsAction} className="entity-form entity-form-inline">
            <input type="hidden" name="provider" value={integration?.provider ?? "GOOGLE_DRIVE"} />
            <label className="full-span">
              <span>URL carpeta raíz</span>
              <input
                name="rootFolderUrl"
                placeholder="https://drive.google.com/drive/folders/..."
                defaultValue={integration?.rootFolderUrl ?? ""}
              />
            </label>
            <label className="full-span">
              <span>Notas internas</span>
              <textarea
                name="notes"
                rows={3}
                placeholder="Observaciones sobre la cuenta conectada o la futura migración a otro Drive."
                defaultValue={integration?.notes ?? ""}
              />
            </label>

            <button className="button button-primary" type="submit">
              Guardar configuración
            </button>
          </ActionForm>

          <div className="storage-cta-row">
            {oauthReady ? (
              <Link href="/api/storage/google-drive/connect" className="button button-secondary">
                {integration?.oauthRefreshToken ? "Reconectar Google Drive" : "Conectar Google Drive"}
              </Link>
            ) : (
              <span className="button button-secondary button-disabled" aria-disabled="true">
                Conectar Google Drive
              </span>
            )}
            <p className="storage-cta-copy">
              {oauthReady
                ? "Este paso sí abre Google para iniciar sesión y validar permisos sobre la carpeta raíz."
                : "Cuando el servidor tenga OAuth configurado, este botón abrirá Google para iniciar sesión y conceder permisos."}
            </p>
          </div>
          <ActionForm action={validateGoogleDriveAction} className="storage-cta-row">
            <button
              className="button button-secondary"
              type="submit"
              disabled={!integration?.oauthRefreshToken}
            >
              Validar Drive y carpetas
            </button>
            <p className="storage-cta-copy">
              Verifica acceso real a la raíz, crea carpetas faltantes y deja estado en
              conectado.
            </p>
          </ActionForm>
        </article>

        <article className="panel">
          <div className="module-list-header">
            <div>
              <p className="card-label">Qué hará esta integración</p>
              <p>
                Este flujo conecta Drive, valida permisos y asegura la estructura de carpetas para backups y adjuntos.
              </p>
            </div>
          </div>

          <div className="entity-list">
            <article className="entity-card">
              <h3>Flujo previsto</h3>
              <div className="entry-summary-list">
                <div className="entry-summary-row">
                  <span>1. Conectar Google Drive</span>
                  <span>OAuth</span>
                </div>
                <div className="entry-summary-row">
                  <span>2. Validar acceso a la raíz</span>
                  <span>Lectura + escritura</span>
                </div>
                <div className="entry-summary-row">
                  <span>3. Asegurar subcarpetas</span>
                  <span>Crear si faltan</span>
                </div>
                <div className="entry-summary-row">
                  <span>4. Subir backups y adjuntos</span>
                  <span>Automático</span>
                </div>
              </div>
            </article>

            <article className="entity-card">
              <h3>Estructura prevista</h3>
              <div className="entry-summary-list">
                {configuredFolders.map((folder) => (
                  <div key={folder.type} className="entry-summary-row">
                    <span>{getStorageFolderLabel(folder.type)}</span>
                    <span>{getStorageStatusLabel(folder.status)}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="entity-card">
              <h3>Estado actual</h3>
              <p className="entity-notes">
                La conexión OAuth, la validación de raíz y la verificación de subcarpetas se pueden completar desde esta pantalla.
              </p>
              {integration ? (
                <dl className="entity-meta">
                  <div>
                    <dt>Proveedor</dt>
                    <dd>{getStorageProviderLabel(integration.provider)}</dd>
                  </div>
                  <div>
                    <dt>Cuenta</dt>
                    <dd>{integration.connectedAccountEmail ?? "Pendiente"}</dd>
                  </div>
                  <div>
                    <dt>Raíz</dt>
                    <dd>{integration.rootFolderUrl ?? "Sin definir"}</dd>
                  </div>
                  <div>
                    <dt>Estado</dt>
                    <dd>{getStorageStatusLabel(integration.status)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="entity-notes">Aún no hay configuración guardada.</p>
              )}

              <ActionForm action={resetStorageSettingsAction}>
                <button className="button button-secondary" type="submit">
                  Limpiar configuración
                </button>
              </ActionForm>
            </article>
          </div>
        </article>
      </div>
    </section>
  );
}
