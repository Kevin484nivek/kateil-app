import {
  createCategoryAction,
  createProductSubtypeAction,
  createSeasonAction,
  toggleCategoryAction,
  toggleProductSubtypeAction,
  toggleSeasonAction,
  updateCategoryAction,
  updateProductSubtypeAction,
  updateSeasonAction,
} from "@/app/(private)/catalogs/actions";
import { ActionForm } from "@/components/ui/action-form";
import { prisma } from "@/lib/db/prisma";

type CatalogChild = {
  id: string;
  name: string;
  isActive: boolean;
  categoryId: string;
};

type CategoryRecord = {
  id: string;
  name: string;
  isActive: boolean;
  productSubtypes: CatalogChild[];
  seasons: CatalogChild[];
};

function CategoryChildSection(props: {
  createAction: (formData: FormData) => void | Promise<void>;
  items: CatalogChild[];
  label: string;
  categoryId: string;
  categories: Array<{ id: string; name: string }>;
  toggleAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <section className="catalog-child-section">
      <div className="module-list-header">
        <div>
          <p className="card-label">{props.label}</p>
          <p>Elementos asociados directamente a esta categoría.</p>
        </div>
      </div>

      <ActionForm action={props.createAction} className="supplier-search">
        <input type="hidden" name="categoryId" value={props.categoryId} />
        <input name="name" placeholder={`Nuevo ${props.label.toLowerCase()}`} required />
        <button className="button button-primary" type="submit">
          Añadir
        </button>
      </ActionForm>

      <div className="entity-list">
        {props.items.length === 0 ? (
          <article className="entity-card">
            <h3>Sin elementos</h3>
            <p>Todavía no hay {props.label.toLowerCase()} asociados a esta categoría.</p>
          </article>
        ) : null}

        {props.items.map((item) => (
          <article key={item.id} className="entity-card">
            <div className="entity-card-header">
              <div>
                <h3>{item.name}</h3>
              </div>
              <span className={`status-pill ${item.isActive ? "status-active" : ""}`}>
                {item.isActive ? "Activo" : "Inactivo"}
              </span>
            </div>

            <details className="entity-edit-block">
              <summary>Editar {props.label.toLowerCase()}</summary>
              <ActionForm action={props.updateAction} className="entity-form entity-form-inline">
                <input type="hidden" name="id" value={item.id} />
                <label>
                  <span>Categoría</span>
                  <select name="categoryId" defaultValue={item.categoryId} required>
                    {props.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Nombre</span>
                  <input name="name" defaultValue={item.name} required />
                </label>
                <button className="button button-primary" type="submit">
                  Guardar cambios
                </button>
              </ActionForm>
            </details>

            <ActionForm action={props.toggleAction}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="nextState" value={String(!item.isActive)} />
              <button className="button button-secondary" type="submit">
                {item.isActive ? "Desactivar" : "Reactivar"}
              </button>
            </ActionForm>
          </article>
        ))}
      </div>
    </section>
  );
}

function CategoryCard(props: {
  category: CategoryRecord;
  categories: Array<{ id: string; name: string }>;
}) {
  return (
    <details className="panel category-catalog-card category-catalog-accordion">
      <summary className="entity-card-summary">
        <div>
          <p className="card-label">Categoría</p>
          <h2>{props.category.name}</h2>
        </div>
        <div className="entity-summary-meta">
          <span className={`status-pill ${props.category.isActive ? "status-active" : ""}`}>
            {props.category.isActive ? "Activa" : "Inactiva"}
          </span>
          <strong>
            {props.category.productSubtypes.length} subtipos · {props.category.seasons.length} temporadas
          </strong>
        </div>
      </summary>

      <div className="category-catalog-body">
        <details className="entity-edit-block">
          <summary>Editar categoría</summary>
          <ActionForm action={updateCategoryAction} className="entity-form entity-form-inline">
            <input type="hidden" name="id" value={props.category.id} />
            <label className="full-span">
              <span>Nombre</span>
              <input name="name" defaultValue={props.category.name} required />
            </label>
            <button className="button button-primary" type="submit">
              Guardar cambios
            </button>
          </ActionForm>
        </details>

        <ActionForm action={toggleCategoryAction}>
          <input type="hidden" name="id" value={props.category.id} />
          <input type="hidden" name="nextState" value={String(!props.category.isActive)} />
          <button className="button button-secondary" type="submit">
            {props.category.isActive ? "Desactivar categoría" : "Reactivar categoría"}
          </button>
        </ActionForm>

        <div className="category-catalog-grid">
          <CategoryChildSection
            categories={props.categories}
            categoryId={props.category.id}
            createAction={createProductSubtypeAction}
            items={props.category.productSubtypes}
            label="Subtipos"
            toggleAction={toggleProductSubtypeAction}
            updateAction={updateProductSubtypeAction}
          />
          <CategoryChildSection
            categories={props.categories}
            categoryId={props.category.id}
            createAction={createSeasonAction}
            items={props.category.seasons}
            label="Temporadas"
            toggleAction={toggleSeasonAction}
            updateAction={updateSeasonAction}
          />
        </div>
      </div>
    </details>
  );
}

export default async function CatalogsPage() {
  const categoriesRaw = await prisma.category.findMany({
    include: {
      productSubtypes: {
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      },
      seasons: {
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  const categories = [...categoriesRaw].sort((left, right) => {
    if (left.name === "Ropa" && right.name !== "Ropa") {
      return -1;
    }
    if (right.name === "Ropa" && left.name !== "Ropa") {
      return 1;
    }
    return left.name.localeCompare(right.name, "es");
  });

  const categoryOptions = categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));
  const totalChildren = categories.reduce(
    (acc, category) => acc + category.productSubtypes.length + category.seasons.length,
    0,
  );

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Productos</p>
          <h1>Configuración de catálogo</h1>
          <p>Categorías primero, y dentro de cada una sus subtipos y temporadas asociados.</p>
        </div>
        <span className="module-meta">
          {categories.length} categorías · {totalChildren} elementos asociados
        </span>
      </div>

      <article className="panel">
        <div className="module-list-header">
          <div>
            <p className="card-label">Nueva categoría</p>
            <p>Crea primero la categoría principal y después añade sus hijos debajo.</p>
          </div>
        </div>
        <ActionForm action={createCategoryAction} className="supplier-search">
          <input name="name" placeholder="Nueva categoría" required />
          <button className="button button-primary" type="submit">
            Añadir
          </button>
        </ActionForm>
      </article>

      <div className="entity-list">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} categories={categoryOptions} />
        ))}
      </div>
    </section>
  );
}
