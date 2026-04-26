"use client";

import { useState } from "react";

type UserCreateModalProps = {
  allowSuperadmin: boolean;
  createUserAction: (formData: FormData) => void | Promise<void>;
};

export function UserCreateModal({
  allowSuperadmin,
  createUserAction,
}: UserCreateModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button className="button button-primary" type="button" onClick={() => setIsOpen(true)}>
        Nuevo usuario
      </button>

      {isOpen ? (
        <div className="inventory-success-modal" role="dialog" aria-modal="true">
          <div className="inventory-success-card user-create-card">
            <p className="card-label">Alta de usuario</p>
            <h2>Crear nuevo perfil</h2>
            <p>
              Completa nombre, email, contraseña temporal y rol. El alta quedará disponible en
              cuanto guardes.
            </p>

            <form action={createUserAction} className="entity-form entity-form-inline">
              <label>
                <span>Nombre</span>
                <input name="name" required />
              </label>
              <label>
                <span>Email</span>
                <input name="email" type="email" required />
              </label>
              <label>
                <span>Contraseña temporal</span>
                <input name="password" type="password" minLength={8} required />
              </label>
              <label>
                <span>Rol</span>
                <select name="role" defaultValue="ADMIN">
                  {allowSuperadmin ? <option value="SUPERADMIN">Superadmin</option> : null}
                  <option value="ADMIN">Admin</option>
                  <option value="SUPERUSER">Superusuario</option>
                </select>
              </label>
              <div className="inventory-success-actions full-span">
                <button className="button button-secondary" type="button" onClick={() => setIsOpen(false)}>
                  Cancelar
                </button>
                <button className="button button-primary" type="submit">
                  Crear usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
