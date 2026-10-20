/**
 * Demo photos from Unsplash (free to use under the Unsplash License, loaded straight from
 * their CDN). Replace with the shop's own photos — portfolio, products and units — before
 * going live; in Supabase they are plain URL columns.
 */
export function unsplash(id: string, width = 900): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=70`;
}

export const COVER_PHOTO = unsplash("1585747860715-2ba37e788b70", 1600);

/** Haircuts and beards for the "Resultados" feed. */
export const PORTFOLIO = [
  { id: "1593702275687-f8b402bf1fb5", caption: "Corte social na tesoura", barberId: "barber-bigode" },
  { id: "1599351431202-1e0f0137899a", caption: "Acabamento na navalha", barberId: "barber-markos" },
  { id: "1517832606299-7ae9b720a186", caption: "Barba alinhada", barberId: "barber-herbert" },
  { id: "1635273051937-a0ddef9573b6", caption: "Degradê na máquina", barberId: "barber-gustavo" },
  { id: "1657105052497-f996284ffff8", caption: "Corte com textura", barberId: "barber-jey" },
  { id: "1648221122323-572c13a31663", caption: "Corte clássico", barberId: "barber-jonathan" },
  { id: "1647140655214-e4a2d914971f", caption: "Corte na tesoura", barberId: "barber-silas" },
  { id: "1605497788044-5a32c7078486", caption: "Finalização com escova", barberId: "barber-matheus" },
].map((p) => ({ url: unsplash(p.id, 700), caption: p.caption, barberId: p.barberId }));

/** Shop atmosphere, for the web hero and unit cards. */
export const SHOP_PHOTOS = {
  "unit-chacara": unsplash("1503951914875-452162b0f3f1", 1200),
  "unit-guarapiranga": unsplash("1759134198561-e2041049419c", 1200),
} as Record<string, string>;

export const PRODUCT_PHOTOS: Record<string, string> = {
  "prd-pomade-matte": unsplash("1621605815971-fbc98d665033", 600),
  "prd-beard-oil": unsplash("1673350963924-cb4267d9b6eb", 600),
  "prd-beard-balm": unsplash("1515377905703-c4788e51af15", 600),
  "prd-beard-shampoo": unsplash("1627875777089-d32f1127e9ff", 600),
  "prd-hair-tonic": unsplash("1620018646973-e3e257a1002c", 600),
  "prd-aftershave": unsplash("1627876280688-24a58ba02f2c", 600),
  "prd-texture-powder": unsplash("1627875777314-da35433c0c8e", 600),
  "prd-beard-kit": unsplash("1673350963997-fc802e774580", 600),
};

/** Before/after pairs (same session, same person) for the demo customer's gallery. */
export const GALLERY_PAIRS = [
  { before: unsplash("1672761431756-7da1362efad3", 800), after: unsplash("1672761431756-4ec00cf7162a", 800) },
  { before: unsplash("1593702295094-aea22597af65", 800), after: unsplash("1593702275687-f8b402bf1fb5", 800) },
  { before: unsplash("1635273051839-003bf06a8751", 800), after: unsplash("1635273051937-a0ddef9573b6", 800) },
];
