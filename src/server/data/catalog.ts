import type { Barber, OpeningHours, Plan, Product, Service, Shop, Unit } from "@/domain/types";

/**
 * Mister Bigode catalog.
 *
 * From mrbigode.com.br (Oct 2026): units, addresses, opening hours, the professionals,
 * the service list and the Mister Club plans with their prices.
 *
 * ESTIMATES TO REPLACE with the shop's real numbers: service prices and durations,
 * which unit each barber works at, commission rates and the whole product list
 * (the site does not publish them).
 */

export const SHOP: Shop = {
  name: "Mister Bigode",
  tagline: "Mais que um corte. Uma experiência.",
  instagram: "@misterbigode_of",
  memberCountLabel: "+500 membros no Mister Club",
  ratingLabel: "4,9 no Google · +700 avaliações",
};

const WEEKDAY: OpeningHours = { open: 9 * 60, close: 20 * 60 };
const SATURDAY: OpeningHours = { open: 9 * 60, close: 19 * 60 };
const HOURS = [null, WEEKDAY, WEEKDAY, WEEKDAY, WEEKDAY, WEEKDAY, SATURDAY];

export const UNITS: Unit[] = [
  { id: "unit-chacara", name: "Chácara Santo Antônio", address: "Rua José de Carvalho, 191 · São Paulo", phone: "(11) 97727-1896", hours: HOURS },
  { id: "unit-guarapiranga", name: "Guarapiranga", address: "Avenida Guarapiranga, 2431 · São Paulo", phone: null, hours: HOURS },
];

const barber = (id: string, name: string, unitId: string, active = true): Barber => ({
  id,
  name,
  unitId,
  active,
  serviceCommission: 0.4,
  productCommission: 0.1,
});

export const BARBERS: Barber[] = [
  barber("barber-bigode", "Bigode", "unit-chacara"),
  barber("barber-markos", "Markos Henrique", "unit-chacara"),
  barber("barber-herbert", "Herbert", "unit-chacara"),
  barber("barber-jonathan", "Jonathan Aguiar", "unit-chacara"),
  barber("barber-silas", "Silas Silva", "unit-chacara"),
  barber("barber-gustavo", "Gustavo", "unit-guarapiranga"),
  barber("barber-jey", "Jey", "unit-guarapiranga"),
  barber("barber-jhonny", "Jhonny", "unit-guarapiranga"),
  barber("barber-matheus", "Matheus", "unit-guarapiranga"),
  // Fictional former barber, so the dashboard shows how inactive barbers are handled.
  barber("barber-former", "Rodrigo (desligado)", "unit-guarapiranga", false),
];

const service = (
  id: string,
  name: string,
  category: Service["category"],
  durationMin: number,
  reais: number,
  coverage: Service["coverage"] = null,
  bookable = true,
): Service => ({ id, name, category, durationMin, priceCents: Math.round(reais * 100), coverage, bookable });

export const SERVICES: Service[] = [
  service("svc-haircut", "Corte", "hair", 40, 80, "haircut"),
  service("svc-haircut-scissor", "Corte afro ou tesoura", "hair", 50, 90, "haircut"),
  service("svc-haircut-kids", "Corte infantil", "hair", 30, 55),
  service("svc-haircut-women", "Corte feminino", "hair", 50, 90),
  service("svc-neckline", "Pezinho (acabamento)", "hair", 15, 25),
  service("svc-freestyle", "Freestyle", "hair", 20, 30),
  service("svc-styling", "Penteado", "hair", 20, 40),
  service("svc-blowdry", "Escova", "hair", 30, 45),
  service("svc-beard", "Barba", "beard", 30, 65, "beard"),
  service("svc-mustache", "Bigode", "beard", 15, 25),
  service("svc-hydration", "Hidratação", "treatment", 30, 50),
  service("svc-straightening", "Botox / progressiva", "treatment", 90, 150),
  service("svc-scalp-therapy", "Terapia capilar", "treatment", 45, 90),
  service("svc-scrub", "Esfoliante", "treatment", 15, 35),
  service("svc-facial-spa", "Spa facial", "treatment", 40, 80),
  service("svc-facial-spa-pores", "Spa + remoção de cravos", "treatment", 60, 110),
  service("svc-relaxing", "Relaxamento", "treatment", 60, 80),
  service("svc-pigmentation", "Pigmentação", "treatment", 20, 50),
  service("svc-toppik", "Toppik", "treatment", 15, 30),
  service("svc-hair-prosthesis", "Manutenção de prótese capilar", "treatment", 90, 200),
  service("svc-eyebrow", "Sobrancelha", "finishing", 15, 25),
  service("svc-eyebrow-wax", "Sobrancelha na cera", "finishing", 15, 30),
  service("svc-nose-ear-wax", "Depilação de nariz ou orelha", "finishing", 10, 20),
];

const plan = (
  id: string,
  name: string,
  tier: Plan["tier"],
  covers: Plan["covers"],
  reais: number,
  sortOrder: number,
  highlight: Plan["highlight"] = null,
): Plan => ({
  id,
  name,
  tier,
  covers,
  priceCents: Math.round(reais * 100),
  highlight,
  sortOrder,
  benefits: [
    ...(covers.includes("haircut") ? ["Corte incluso"] : []),
    ...(covers.includes("beard") ? ["Barba inclusa"] : []),
    "Vigência por tempo indeterminado",
    "Cobrança mensal automática",
  ],
});

/** The six plans, in the order the shop lists them today. */
export const PLANS: Plan[] = [
  plan("plan-cb-plus", "Mister Club C+B Plus", "plus", ["haircut", "beard"], 249.99, 1),
  plan("plan-haircut-plus", "Mister Club Corte Plus", "plus", ["haircut"], 149.99, 2),
  plan("plan-beard-plus", "Mister Club Barba Plus", "plus", ["beard"], 159.99, 3),
  plan("plan-cb-premium", "Mister Club Premium Corte e Barba", "premium", ["haircut", "beard"], 349.99, 4, "best_seller"),
  plan("plan-beard-premium", "Mister Club Premium Barba", "premium", ["beard"], 229.99, 5),
  plan("plan-haircut-premium", "Mister Club Premium Corte", "premium", ["haircut"], 199.99, 6),
];

const product = (
  id: string,
  name: string,
  category: Product["category"],
  description: string,
  reais: number,
  stock: number,
  minStock = 4,
): Product => ({
  id,
  name,
  category,
  description,
  priceCents: Math.round(reais * 100),
  costCents: Math.round(reais * 100 * 0.45),
  stock,
  minStock,
  active: true,
});

/** Example showcase. Replace with what the shop actually sells. */
export const PRODUCTS: Product[] = [
  product("prd-pomade-matte", "Pomada modeladora efeito seco", "hair", "Fixação forte e acabamento matte, para o dia todo.", 59.9, 18),
  product("prd-pomade-shine", "Pomada efeito brilho", "hair", "Fixação média com brilho, ideal para penteados clássicos.", 59.9, 11),
  product("prd-texture-powder", "Pó texturizador", "hair", "Volume e textura sem pesar no cabelo.", 49.9, 3),
  product("prd-hair-tonic", "Tônico capilar", "hair", "Uso diário para fortalecer o couro cabeludo.", 69.9, 9),
  product("prd-shampoo-daily", "Shampoo uso diário", "hair", "Limpeza suave para cabelo masculino.", 44.9, 14),
  product("prd-beard-oil", "Óleo para barba", "beard", "Hidrata os fios e a pele, sem deixar oleosa.", 49.9, 22),
  product("prd-beard-balm", "Balm para barba", "beard", "Alinha e modela a barba com leve fixação.", 44.9, 7),
  product("prd-beard-shampoo", "Shampoo para barba", "beard", "Limpa sem ressecar a pele do rosto.", 39.9, 12),
  product("prd-aftershave", "Pós-barba calmante", "skin", "Acalma a pele depois do barbear.", 39.9, 2),
  product("prd-face-scrub", "Esfoliante facial", "skin", "Remove impurezas e prepara a pele para o barbear.", 42.9, 8),
  product("prd-wood-comb", "Pente de madeira", "accessory", "Antiestático, para barba e cabelo.", 24.9, 25),
  product("prd-beard-kit", "Kit barba completa", "accessory", "Óleo, balm e shampoo para barba com desconto.", 119.9, 5, 3),
];
