import "dotenv/config";
import { hashPassword } from "@backend/modules/auth/auth.password";
import { pool } from "@backend/shared/db/pool";

const DEV_PASSWORD = "FoodLikeDev1!";

type ProductSeed = {
  name: string;
  category: string;
  unit: string;
  stockQuantity: number;
  priceCents: number;
  description: string;
};

type EmployeeSeed = {
  name: string;
  email: string;
  role: string;
  phone: string;
};

const employees = [
  { name: "Анна Управляющая", email: "admin@foodlike.dev", role: "Управляющий", phone: "+7 900 100-00-01" },
  { name: "Дима Диспетчер", email: "dispatcher@foodlike.dev", role: "Диспетчер", phone: "+7 900 100-00-02" },
  { name: "Полина Повар", email: "cook@foodlike.dev", role: "Повар", phone: "+7 900 100-00-03" },
  { name: "Кирилл Курьер", email: "courier@foodlike.dev", role: "Курьер", phone: "+7 900 100-00-04" },
] as const;

function getOptionalSmokeEmployee() {
  const phone = process.env.LOCAL_SMOKE_PHONE?.trim();
  const password = process.env.LOCAL_SMOKE_PASSWORD?.trim();

  if (!phone || !password) {
    return null;
  }

  return {
    employee: {
      name: "Local Smoke User",
      email: "local-smoke@foodlike.dev",
      role: "Управляющий",
      phone,
    },
    password,
  } as const;
}

const products: ProductSeed[] = [
  {
    name: "Мука пшеничная",
    category: "Сухой склад",
    unit: "кг",
    stockQuantity: 25,
    priceCents: 9000,
    description: "Базовый ингредиент для теста",
  },
  {
    name: "Сыр моцарелла",
    category: "Холодильник",
    unit: "кг",
    stockQuantity: 12,
    priceCents: 52000,
    description: "Сыр для пиццы и горячих блюд",
  },
  {
    name: "Томатный соус",
    category: "Холодильник",
    unit: "л",
    stockQuantity: 8,
    priceCents: 18000,
    description: "Соус для пиццы",
  },
] as const;

async function ensureUser(phone: string, role: string) {
  await pool.query(
    `
      INSERT INTO "User" ("phone", "password", "role")
      VALUES ($1, $2, $3)
      ON CONFLICT ("phone")
      DO UPDATE SET
        "password" = EXCLUDED."password",
        "role" = EXCLUDED."role"
    `,
    [phone, hashPassword(DEV_PASSWORD), role],
  );
}

async function ensureUserWithPassword(phone: string, role: string, password: string) {
  await pool.query(
    `
      INSERT INTO "User" ("phone", "password", "role")
      VALUES ($1, $2, $3)
      ON CONFLICT ("phone")
      DO UPDATE SET
        "password" = EXCLUDED."password",
        "role" = EXCLUDED."role"
    `,
    [phone.replace(/\D/g, ""), hashPassword(password), role],
  );
}

async function ensureEmployee(employee: EmployeeSeed) {
  const result = await pool.query<{ id: number }>(
    `
      INSERT INTO "Employee" ("name", "email", "role", "phone", "messenger")
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT ("email")
      DO UPDATE SET
        "name" = EXCLUDED."name",
        "role" = EXCLUDED."role",
        "phone" = EXCLUDED."phone",
        "messenger" = EXCLUDED."messenger"
      RETURNING "id"
    `,
    [employee.name, employee.email, employee.role, employee.phone, "Telegram"],
  );

  return result.rows[0]?.id;
}

async function ensureClient() {
  await pool.query(
    `
      INSERT INTO "Client" ("name", "type", "email", "phone", "address", "notes")
      VALUES ($1, 'CLIENT', $2, $3, $4, $5)
      ON CONFLICT ("phone")
      DO UPDATE SET
        "name" = EXCLUDED."name",
        "email" = EXCLUDED."email",
        "address" = EXCLUDED."address",
        "notes" = EXCLUDED."notes"
    `,
    [
      "Мария Тестовая",
      "client@foodlike.dev",
      "+7 900 200-00-01",
      "ул. Демо, 12",
      "Dev-клиент для локальной проверки заказов",
    ],
  );
}

async function ensureProduct(product: ProductSeed) {
  const existing = await pool.query<{ id: number }>(
    `SELECT "id" FROM "Product" WHERE "name" = $1 LIMIT 1`,
    [product.name],
  );

  if (existing.rows[0]) {
    await pool.query(
      `
        UPDATE "Product"
        SET "category" = $2,
            "unit" = $3,
            "stockQuantity" = GREATEST("stockQuantity", $4),
            "priceCents" = $5,
            "description" = $6
        WHERE "id" = $1
      `,
      [
        existing.rows[0].id,
        product.category,
        product.unit,
        product.stockQuantity,
        product.priceCents,
        product.description,
      ],
    );
    return existing.rows[0].id;
  }

  const created = await pool.query<{ id: number }>(
    `
      INSERT INTO "Product" ("name", "category", "unit", "stockQuantity", "priceCents", "description")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING "id"
    `,
    [
      product.name,
      product.category,
      product.unit,
      product.stockQuantity,
      product.priceCents,
      product.description,
    ],
  );

  return created.rows[0]?.id;
}

async function ensureTechCard(productIds: Record<string, number>) {
  const existing = await pool.query<{ id: number }>(
    `SELECT "id" FROM "TechnologicalCard" WHERE "name" = $1 LIMIT 1`,
    ["Маргарита dev"],
  );
  const techCardId = existing.rows[0]?.id ?? (await createTechCard());

  await pool.query(`DELETE FROM "TechCardIngredient" WHERE "technologicalCardId" = $1`, [techCardId]);
  await pool.query(
    `
      INSERT INTO "TechCardIngredient" ("technologicalCardId", "productId", "quantity", "unit")
      VALUES
        ($1, $2, 0.25, 'кг'),
        ($1, $3, 0.18, 'кг'),
        ($1, $4, 0.08, 'л')
    `,
    [
      techCardId,
      productIds["Мука пшеничная"],
      productIds["Сыр моцарелла"],
      productIds["Томатный соус"],
    ],
  );

  await pool.query(
    `
      INSERT INTO "CatalogItem" (
        "name",
        "slug",
        "category",
        "description",
        "priceCents",
        "isPublished",
        "displayOrder",
        "technologicalCardId"
      )
      VALUES ($1, $2, $3, $4, $5, true, 10, $6)
      ON CONFLICT ("slug")
      DO UPDATE SET
        "name" = EXCLUDED."name",
        "category" = EXCLUDED."category",
        "description" = EXCLUDED."description",
        "priceCents" = EXCLUDED."priceCents",
        "isPublished" = EXCLUDED."isPublished",
        "displayOrder" = EXCLUDED."displayOrder",
        "technologicalCardId" = EXCLUDED."technologicalCardId"
    `,
    [
      "Пицца Маргарита dev",
      "dev-margherita",
      "Пицца",
      "Тестовая позиция для локальных заказов и списания ингредиентов",
      59000,
      techCardId,
    ],
  );

  return techCardId;
}

async function createTechCard() {
  const created = await pool.query<{ id: number }>(
    `
      INSERT INTO "TechnologicalCard" ("name", "category", "pizzaSize", "outputQuantity", "outputUnit", "description")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING "id"
    `,
    ["Маргарита dev", "Пицца", "30 см", 1, "шт", "Dev-техкарта для проверки списания"],
  );

  const id = created.rows[0]?.id;
  if (!id) {
    throw new Error("Failed to create dev tech card");
  }
  return id;
}

async function main() {
  const productIds: Record<string, number> = {};

  for (const employee of employees) {
    await ensureEmployee(employee);
    await ensureUser(employee.phone.replace(/\D/g, ""), employee.role);
  }

  const smoke = getOptionalSmokeEmployee();
  if (smoke) {
    await ensureEmployee(smoke.employee);
    await ensureUserWithPassword(smoke.employee.phone, smoke.employee.role, smoke.password);
  }

  await ensureClient();

  for (const product of products) {
    const id = await ensureProduct(product);
    if (!id) {
      throw new Error(`Failed to seed product: ${product.name}`);
    }
    productIds[product.name] = id;
  }

  await ensureTechCard(productIds);

  console.log(`Dev seed is ready. Test password for seeded users: ${DEV_PASSWORD}`);
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
