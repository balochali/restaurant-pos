import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import crypto from "crypto";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function hashPin(pin: string): string {
  return crypto.createHash("sha256").update(pin).digest("hex");
}

// Fixed UUIDs — guarantees upsert is idempotent across re-runs
const IDS = {
  // Users
  userAdmin: "00000000-0000-0000-0000-000000000001",
  userCashier: "00000000-0000-0000-0000-000000000002",
  userWaiter: "00000000-0000-0000-0000-000000000003",

  // Categories
  catBurgers: "00000000-0000-0000-0001-000000000001",
  catDrinks: "00000000-0000-0000-0001-000000000002",
  catSides: "00000000-0000-0000-0001-000000000003",
  catDesserts: "00000000-0000-0000-0001-000000000004",

  // Menu Items
  itemClassicBurger: "00000000-0000-0000-0002-000000000001",
  itemCheeseBurger: "00000000-0000-0000-0002-000000000002",
  itemBBQBurger: "00000000-0000-0000-0002-000000000003",
  itemCoke: "00000000-0000-0000-0002-000000000004",
  itemLemonade: "00000000-0000-0000-0002-000000000005",
  itemIcedTea: "00000000-0000-0000-0002-000000000006",
  itemFries: "00000000-0000-0000-0002-000000000007",
  itemOnionRings: "00000000-0000-0000-0002-000000000008",
  itemBrownie: "00000000-0000-0000-0002-000000000009",
  itemIceCream: "00000000-0000-0000-0002-000000000010",

  // Variants (drink sizes)
  varCokeSmall: "00000000-0000-0000-0003-000000000001",
  varCokeMedium: "00000000-0000-0000-0003-000000000002",
  varCokeLarge: "00000000-0000-0000-0003-000000000003",
  varLemonSmall: "00000000-0000-0000-0003-000000000004",
  varLemonMedium: "00000000-0000-0000-0003-000000000005",
  varLemonLarge: "00000000-0000-0000-0003-000000000006",
  varTeaSmall: "00000000-0000-0000-0003-000000000007",
  varTeaMedium: "00000000-0000-0000-0003-000000000008",
  varTeaLarge: "00000000-0000-0000-0003-000000000009",

  // Modifiers
  modExtraCheese: "00000000-0000-0000-0004-000000000001",
  modNoOnions: "00000000-0000-0000-0004-000000000002",
  modExtraSauce: "00000000-0000-0000-0004-000000000003",
  modSpicy: "00000000-0000-0000-0004-000000000004",
  modWellDone: "00000000-0000-0000-0004-000000000005",
};

async function main() {
  console.log("🌱 Starting database seed...\n");

  // ─── USERS ───────────────────────────────────────────────────────────────
  console.log("👥 Seeding users...");

  await prisma.user.upsert({
    where: { id: IDS.userAdmin },
    update: {},
    create: {
      id: IDS.userAdmin,
      name: "Admin User",
      username: "admin",
      pinHash: hashPin("1234"),
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { id: IDS.userCashier },
    update: {},
    create: {
      id: IDS.userCashier,
      name: "Sarah Cashier",
      username: "cashier1",
      pinHash: hashPin("2222"),
      role: "CASHIER",
    },
  });

  await prisma.user.upsert({
    where: { id: IDS.userWaiter },
    update: {},
    create: {
      id: IDS.userWaiter,
      name: "John Waiter",
      username: "waiter1",
      pinHash: hashPin("3333"),
      role: "WAITER",
    },
  });

  console.log("  ✅ 3 users seeded");
  console.log("     admin    → PIN: 1234  (ADMIN)");
  console.log("     cashier1 → PIN: 2222  (CASHIER)");
  console.log("     waiter1  → PIN: 3333  (WAITER)\n");

  // ─── MENU CATEGORIES ─────────────────────────────────────────────────────
  console.log("🗂️  Seeding menu categories...");

  const categories = [
    { id: IDS.catBurgers, name: "Burgers", displayOrder: 1 },
    { id: IDS.catDrinks, name: "Drinks", displayOrder: 2 },
    { id: IDS.catSides, name: "Sides", displayOrder: 3 },
    { id: IDS.catDesserts, name: "Desserts", displayOrder: 4 },
  ];

  for (const cat of categories) {
    await prisma.menuCategory.upsert({
      where: { id: cat.id },
      update: {},
      create: cat,
    });
  }

  console.log("  ✅ 4 categories seeded (Burgers, Drinks, Sides, Desserts)\n");

  // ─── MENU ITEMS ───────────────────────────────────────────────────────────
  console.log("🍔 Seeding menu items...");

  type MenuItemSeed = {
    id: string;
    name: string;
    description: string;
    basePrice: number;
    categoryId: string;
    taxRate: number;
  };

  const menuItems: MenuItemSeed[] = [
    // Burgers
    {
      id: IDS.itemClassicBurger,
      categoryId: IDS.catBurgers,
      name: "Classic Burger",
      description: "Juicy beef patty with lettuce, tomato, and pickles",
      basePrice: 8.99,
      taxRate: 0.08,
    },
    {
      id: IDS.itemCheeseBurger,
      categoryId: IDS.catBurgers,
      name: "Cheese Burger",
      description: "Classic burger topped with melted cheddar cheese",
      basePrice: 9.99,
      taxRate: 0.08,
    },
    {
      id: IDS.itemBBQBurger,
      categoryId: IDS.catBurgers,
      name: "BBQ Bacon Burger",
      description: "Smoked beef patty with crispy bacon and smoky BBQ sauce",
      basePrice: 12.99,
      taxRate: 0.08,
    },
    // Drinks
    {
      id: IDS.itemCoke,
      categoryId: IDS.catDrinks,
      name: "Coca Cola",
      description: "Ice-cold Coca Cola — choose your size",
      basePrice: 2.99,
      taxRate: 0.05,
    },
    {
      id: IDS.itemLemonade,
      categoryId: IDS.catDrinks,
      name: "Fresh Lemonade",
      description: "Freshly squeezed lemonade — choose your size",
      basePrice: 3.49,
      taxRate: 0.05,
    },
    {
      id: IDS.itemIcedTea,
      categoryId: IDS.catDrinks,
      name: "Iced Tea",
      description: "Chilled sweet iced tea — choose your size",
      basePrice: 2.79,
      taxRate: 0.05,
    },
    // Sides
    {
      id: IDS.itemFries,
      categoryId: IDS.catSides,
      name: "French Fries",
      description: "Golden crispy fries with sea salt",
      basePrice: 3.99,
      taxRate: 0.08,
    },
    {
      id: IDS.itemOnionRings,
      categoryId: IDS.catSides,
      name: "Onion Rings",
      description: "Beer-battered crispy onion rings",
      basePrice: 4.49,
      taxRate: 0.08,
    },
    // Desserts
    {
      id: IDS.itemBrownie,
      categoryId: IDS.catDesserts,
      name: "Chocolate Brownie",
      description: "Warm chocolate brownie with vanilla drizzle",
      basePrice: 5.99,
      taxRate: 0.08,
    },
    {
      id: IDS.itemIceCream,
      categoryId: IDS.catDesserts,
      name: "Vanilla Ice Cream",
      description: "Three scoops of classic vanilla ice cream",
      basePrice: 4.99,
      taxRate: 0.08,
    },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {},
      create: item,
    });
  }

  console.log("  ✅ 10 menu items seeded\n");

  // ─── ITEM VARIANTS (drink sizes) ─────────────────────────────────────────
  console.log("📏 Seeding item variants (drink sizes)...");

  const variants = [
    { id: IDS.varCokeSmall, menuItemId: IDS.itemCoke, name: "Small", price: 1.99 },
    { id: IDS.varCokeMedium, menuItemId: IDS.itemCoke, name: "Medium", price: 2.99 },
    { id: IDS.varCokeLarge, menuItemId: IDS.itemCoke, name: "Large", price: 3.99 },
    { id: IDS.varLemonSmall, menuItemId: IDS.itemLemonade, name: "Small", price: 2.49 },
    { id: IDS.varLemonMedium, menuItemId: IDS.itemLemonade, name: "Medium", price: 3.49 },
    { id: IDS.varLemonLarge, menuItemId: IDS.itemLemonade, name: "Large", price: 4.49 },
    { id: IDS.varTeaSmall, menuItemId: IDS.itemIcedTea, name: "Small", price: 1.79 },
    { id: IDS.varTeaMedium, menuItemId: IDS.itemIcedTea, name: "Medium", price: 2.79 },
    { id: IDS.varTeaLarge, menuItemId: IDS.itemIcedTea, name: "Large", price: 3.79 },
  ];

  for (const variant of variants) {
    await prisma.itemVariant.upsert({
      where: { id: variant.id },
      update: {},
      create: variant,
    });
  }

  console.log("  ✅ 9 variants seeded (Small / Medium / Large per drink)\n");

  // ─── MODIFIERS ────────────────────────────────────────────────────────────
  console.log("🧂 Seeding modifiers...");

  const modifiers = [
    { id: IDS.modExtraCheese, name: "Extra Cheese", priceAdjustment: 1.5 },
    { id: IDS.modNoOnions, name: "No Onions", priceAdjustment: 0 },
    { id: IDS.modExtraSauce, name: "Extra Sauce", priceAdjustment: 0.5 },
    { id: IDS.modSpicy, name: "Spicy", priceAdjustment: 0 },
    { id: IDS.modWellDone, name: "Well Done", priceAdjustment: 0 },
  ];

  for (const modifier of modifiers) {
    await prisma.modifier.upsert({
      where: { id: modifier.id },
      update: {},
      create: modifier,
    });
  }

  console.log("  ✅ 5 modifiers seeded\n");

  // ─── MODIFIER ↔ ITEM LINKS ────────────────────────────────────────────────
  console.log("🔗 Linking modifiers to burger items...");

  const burgerIds = [IDS.itemClassicBurger, IDS.itemCheeseBurger, IDS.itemBBQBurger];
  const modifierIds = [
    IDS.modExtraCheese,
    IDS.modNoOnions,
    IDS.modExtraSauce,
    IDS.modSpicy,
    IDS.modWellDone,
  ];

  for (const menuItemId of burgerIds) {
    for (const modifierId of modifierIds) {
      await prisma.menuItemModifier.upsert({
        where: { menuItemId_modifierId: { menuItemId, modifierId } },
        update: {},
        create: { menuItemId, modifierId },
      });
    }
  }

  console.log("  ✅ 15 modifier links seeded (5 modifiers × 3 burgers)\n");

  // ─── SUMMARY ─────────────────────────────────────────────────────────────
  console.log("✨ Seed complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Users:            3  (admin / cashier1 / waiter1)");
  console.log("  Categories:       4  (Burgers, Drinks, Sides, Desserts)");
  console.log("  Menu Items:      10");
  console.log("  Item Variants:    9  (Small / Medium / Large per drink)");
  console.log("  Modifiers:        5");
  console.log("  Modifier Links:  15  (all modifiers on all burgers)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
