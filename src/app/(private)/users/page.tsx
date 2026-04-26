import type { Route } from "next";
import Link from "next/link";

import { prisma } from "@/lib/db/prisma";
import { formatMadridDateTime } from "@/lib/utils/datetime";
import { getUserSession } from "@/lib/auth/session";
import { UserCreateModal } from "@/components/ui/user-create-modal";
import {
  canCreateUsers,
  canDeleteUsers,
  canEditUsers,
  canManageTargetUser,
  canToggleUsers,
  getRoleLabel,
  isProtectedSuperadmin,
} from "@/lib/auth/roles";

import {
  createUserAction,
  deleteUserAction,
  toggleUserAction,
  updateUserAction,
} from "./actions";

export default async function UsersPage() {
  const [session, users] = await Promise.all([
    getUserSession(),
    prisma.user.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    }),
  ]);

  if (!session) {
    return null;
  }

  const currentUser = users.find((user) => user.id === session.userId) ?? null;

  if (!currentUser) {
    return null;
  }

  const activeUsers = users.filter((user) => user.isActive).length;
  const inactiveUsers = users.length - activeUsers;
  const distinctRoles = new Set(users.map((user) => user.role)).size;

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Usuarios</p>
          <h1>Accesos internos</h1>
          <p>
            Gestión básica de perfiles, estado y roles para Kevin, Nieves, Carlota y
            futuras altas del equipo.
          </p>
        </div>
        <div className="module-chip-row">
          <Link href={"/users/storage" as Route} className="button button-secondary">
            Almacenamiento
          </Link>
          <span className="module-meta">{users.length} usuarios</span>
        </div>
      </div>

      <div className="metric-grid">
        <article className="metric-card">
          <p className="card-label">Usuarios activos</p>
          <strong>{activeUsers}</strong>
        </article>
        <article className="metric-card metric-card-soft">
          <p className="card-label">Usuarios inactivos</p>
          <strong>{inactiveUsers}</strong>
        </article>
        <article className="metric-card">
          <p className="card-label">Roles distintos</p>
          <strong>{distinctRoles}</strong>
        </article>
        <article className="metric-card metric-card-soft">
          <p className="card-label">Tu rol actual</p>
          <strong>{getRoleLabel(currentUser.role)}</strong>
        </article>
      </div>

      <div className="module-grid">
        <article className="panel">
          <div className="module-list-header">
            <div>
              <p className="card-label">Alta de usuario</p>
              <p>
                Nombre, email, contraseña y rol. Kevin es el único perfil que puede ser
                Superadmin.
              </p>
            </div>
          </div>

          <div className="module-chip-row">
            <Link href={"/users/storage" as Route} className="button button-secondary">
              Configurar Google Drive
            </Link>
          </div>

          {canCreateUsers(currentUser.role) ? (
            <div className="module-chip-row">
              <UserCreateModal
                allowSuperadmin={currentUser.role === "SUPERADMIN"}
                createUserAction={createUserAction}
              />
            </div>
          ) : (
            <p>
              Tu perfil puede revisar usuarios y activar o desactivar accesos, pero no crear
              nuevas altas.
            </p>
          )}
        </article>

        <article className="panel">
          <div className="module-list-header">
            <div>
              <p className="card-label">Equipo interno</p>
              <p>
                Cada ficha muestra nombre, email, rol, alta, estado y último inicio de sesión.
              </p>
            </div>
          </div>

          <div className="entity-list">
            {users.map((user) => {
              const canManage = canManageTargetUser(currentUser.role, user.role);
              const canEdit = canEditUsers(currentUser.role) && canManage;
              const canToggle = canToggleUsers(currentUser.role) && canManage;
              const canDelete = canDeleteUsers(currentUser.role) && canManage;
              const isSelf = user.id === currentUser.id;
              const isProtected = isProtectedSuperadmin(user.email);

              return (
                <details key={user.id} className="entity-card entity-card-accordion">
                  <summary className="entity-card-summary">
                    <div>
                      <h3>{user.name}</h3>
                      <p>
                        {user.email} · {getRoleLabel(user.role)}
                      </p>
                    </div>
                    <div className="entity-summary-meta">
                      <span className={`status-pill ${user.isActive ? "status-active" : ""}`}>
                        {user.isActive ? "Activo" : "Inactivo"}
                      </span>
                      <strong>{isProtected ? "Protegido" : "Gestionable"}</strong>
                    </div>
                  </summary>

                  <dl className="entity-meta">
                    <div>
                      <dt>Rol</dt>
                      <dd>{getRoleLabel(user.role)}</dd>
                    </div>
                    <div>
                      <dt>Alta</dt>
                      <dd>{formatMadridDateTime(user.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Último inicio de sesión</dt>
                      <dd>{user.lastLoginAt ? formatMadridDateTime(user.lastLoginAt) : "Sin registros"}</dd>
                    </div>
                    <div>
                      <dt>Estado</dt>
                      <dd>
                        {isProtected
                          ? "Perfil protegido"
                          : user.isActive
                            ? "Puede acceder"
                            : "Acceso deshabilitado"}
                      </dd>
                    </div>
                  </dl>

                  <details className="entity-edit-block">
                    <summary>Editar usuario</summary>
                    {canEdit ? (
                      <form action={updateUserAction} className="entity-form entity-form-inline">
                        <input type="hidden" name="userId" value={user.id} />
                        <label>
                          <span>Nombre</span>
                          <input name="name" required defaultValue={user.name} />
                        </label>
                        <label>
                          <span>Email</span>
                          <input name="email" type="email" required defaultValue={user.email} />
                        </label>
                        <label>
                          <span>Rol</span>
                          <select
                            name="role"
                            defaultValue={user.role}
                            disabled={currentUser.role !== "SUPERADMIN" && user.role === "SUPERADMIN"}
                          >
                            {currentUser.role === "SUPERADMIN" ? (
                              <option value="SUPERADMIN">Superadmin</option>
                            ) : null}
                            <option value="ADMIN">Admin</option>
                            <option value="SUPERUSER">Superusuario</option>
                          </select>
                        </label>
                        <label>
                          <span>Nueva contraseña</span>
                          <input
                            name="password"
                            type="password"
                            minLength={8}
                            placeholder="Déjala vacía si no cambia"
                          />
                        </label>
                        <button className="button button-primary" type="submit">
                          Guardar cambios
                        </button>
                      </form>
                    ) : (
                      <p>No tienes permisos para editar este perfil.</p>
                    )}
                  </details>

                  <div className="module-chip-row">
                    {canToggle ? (
                      <form action={toggleUserAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="nextState" value={String(!user.isActive)} />
                        <button className="button button-secondary" type="submit">
                          {user.isActive ? "Desactivar" : "Reactivar"}
                        </button>
                      </form>
                    ) : null}

                    {canDelete && !isProtected && !isSelf ? (
                      <form action={deleteUserAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <button className="button button-secondary" type="submit">
                          Eliminar usuario
                        </button>
                      </form>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
}
