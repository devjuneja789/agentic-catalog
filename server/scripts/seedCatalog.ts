import mongoose from 'mongoose'
import { config } from '../src/config/env'
import { IProduct, Product } from '../src/models/Product'

const sizesXL: string[] = ['S', 'M', 'L', 'XL']
const sizesXXL: string[] = ['S', 'M', 'L', 'XL', 'XXL']

const sizeVariant = (options: string[]) => [{ name: 'Size', options }]

const img = (slug: string) => `https://picsum.photos/seed/${slug}/600/600`

const products: IProduct[] = [
  {
    name: 'Classic Black Hoodie',
    description: 'Heavyweight cotton-fleece hoodie with a relaxed fit, kangaroo pocket, and ribbed cuffs.',
    category: 'Hoodies',
    price: { amount: 1499, currency: 'INR' },
    stock: 42,
    variants: sizeVariant(sizesXL),
    sku: 'SL-HOD-BLK-001',
    imageUrl: img('sl-hod-blk-001'),
  },
  {
    name: 'Charcoal Grey Hoodie',
    description: 'Brushed-fleece hoodie in charcoal grey, drawstring hood, dropped shoulder seams.',
    category: 'Hoodies',
    price: { amount: 1599, currency: 'INR' },
    stock: 30,
    variants: sizeVariant(sizesXL),
    sku: 'SL-HOD-CHR-002',
    imageUrl: img('sl-hod-chr-002'),
  },
  {
    name: 'Essential White Tee',
    description: '220 GSM combed cotton tee, boxy fit, pre-shrunk, everyday basic.',
    category: 'T-Shirts',
    price: { amount: 599, currency: 'INR' },
    stock: 80,
    variants: sizeVariant(sizesXXL),
    sku: 'SL-TEE-WHT-003',
    imageUrl: img('sl-tee-wht-003'),
  },
  {
    name: 'Essential Black Tee',
    description: '220 GSM combed cotton tee, boxy fit, pre-shrunk, everyday basic.',
    category: 'T-Shirts',
    price: { amount: 599, currency: 'INR' },
    stock: 75,
    variants: sizeVariant(sizesXXL),
    sku: 'SL-TEE-BLK-004',
    imageUrl: img('sl-tee-blk-004'),
  },
  {
    name: 'Sage Green Oversized Tee',
    description: 'Oversized fit tee in sage green with dropped shoulders and a heavy 260 GSM knit.',
    category: 'T-Shirts',
    price: { amount: 799, currency: 'INR' },
    stock: 25,
    variants: sizeVariant(sizesXXL),
    sku: 'SL-TEE-SGE-005',
    imageUrl: img('sl-tee-sge-005'),
  },
  {
    name: 'Striped Crew Neck Tee',
    description: 'Breton-striped crew neck in navy and white, regular fit, 100% cotton jersey.',
    category: 'T-Shirts',
    price: { amount: 899, currency: 'INR' },
    stock: 4,
    variants: sizeVariant(sizesXL),
    sku: 'SL-TEE-STR-006',
    imageUrl: img('sl-tee-str-006'),
  },
  {
    name: 'Slim Fit Denim Shirt',
    description: 'Mid-wash denim shirt, slim fit, button-down collar, chest pocket.',
    category: 'Shirts',
    price: { amount: 1899, currency: 'INR' },
    stock: 20,
    variants: sizeVariant(sizesXL),
    sku: 'SL-SHT-DNM-007',
    imageUrl: img('sl-sht-dnm-007'),
  },
  {
    name: 'Linen Casual Shirt - Beige',
    description: 'Pure linen shirt in beige, relaxed fit, breathable weave, built for humid weather.',
    category: 'Shirts',
    price: { amount: 2199, currency: 'INR' },
    stock: 18,
    variants: sizeVariant(sizesXL),
    sku: 'SL-SHT-BGE-008',
    imageUrl: img('sl-sht-bge-008'),
  },
  {
    name: 'Checked Flannel Shirt',
    description: 'Brushed flannel shirt in a classic red-and-black check, regular fit.',
    category: 'Shirts',
    price: { amount: 1799, currency: 'INR' },
    stock: 22,
    variants: sizeVariant(sizesXL),
    sku: 'SL-SHT-CHK-009',
    imageUrl: img('sl-sht-chk-009'),
  },
  {
    name: 'Grey Melange Joggers',
    description: 'Tapered joggers in grey melange, elastic waistband, zip pockets.',
    category: 'Joggers',
    price: { amount: 1299, currency: 'INR' },
    stock: 35,
    variants: sizeVariant(sizesXL),
    sku: 'SL-JOG-GRY-010',
    imageUrl: img('sl-jog-gry-010'),
  },
  {
    name: 'Black Track Joggers',
    description: 'Ribbed-cuff track joggers in black with side stripe detailing.',
    category: 'Joggers',
    price: { amount: 1399, currency: 'INR' },
    stock: 3,
    variants: sizeVariant(sizesXL),
    sku: 'SL-JOG-BLK-011',
    imageUrl: img('sl-jog-blk-011'),
  },
  {
    name: 'Olive Cargo Joggers',
    description: 'Utility cargo joggers in olive with multiple pockets, tapered leg.',
    category: 'Joggers',
    price: { amount: 1599, currency: 'INR' },
    stock: 28,
    variants: sizeVariant(sizesXL),
    sku: 'SL-JOG-OLV-012',
    imageUrl: img('sl-jog-olv-012'),
  },
  {
    name: 'Bomber Jacket - Navy',
    description: 'Water-resistant bomber jacket in navy, ribbed collar and cuffs, front zip.',
    category: 'Jackets',
    price: { amount: 3499, currency: 'INR' },
    stock: 15,
    variants: sizeVariant(sizesXL),
    sku: 'SL-JKT-NVY-013',
    imageUrl: img('sl-jkt-nvy-013'),
  },
  {
    name: 'Denim Jacket - Light Wash',
    description: 'Classic trucker jacket in light-wash denim, button front, chest pockets.',
    category: 'Jackets',
    price: { amount: 2999, currency: 'INR' },
    stock: 12,
    variants: sizeVariant(sizesXL),
    sku: 'SL-JKT-DNM-014',
    imageUrl: img('sl-jkt-dnm-014'),
  },
  {
    name: 'Quilted Puffer Vest',
    description: 'Lightweight quilted puffer vest, full-zip, stand collar, packable.',
    category: 'Jackets',
    price: { amount: 2799, currency: 'INR' },
    stock: 10,
    variants: sizeVariant(sizesXL),
    sku: 'SL-JKT-PUF-015',
    imageUrl: img('sl-jkt-puf-015'),
  },
  {
    name: 'Block Print Cotton Kurta',
    description: 'Hand block-printed cotton kurta, straight fit, side slits, mandarin collar.',
    category: 'Kurtas',
    price: { amount: 1699, currency: 'INR' },
    stock: 20,
    variants: sizeVariant(sizesXL),
    sku: 'SL-KUR-BLK-016',
    imageUrl: img('sl-kur-blk-016'),
  },
  {
    name: 'Mandarin Collar Kurta - Rust',
    description: 'Solid rust-toned kurta in breathable cotton-blend, mandarin collar, knee length.',
    category: 'Kurtas',
    price: { amount: 1899, currency: 'INR' },
    stock: 16,
    variants: sizeVariant(sizesXL),
    sku: 'SL-KUR-RST-017',
    imageUrl: img('sl-kur-rst-017'),
  },
  {
    name: 'Crew Neck Sweatshirt - Maroon',
    description: 'Fleece-lined crew neck sweatshirt in maroon, ribbed hem and cuffs.',
    category: 'Sweatshirts',
    price: { amount: 1399, currency: 'INR' },
    stock: 24,
    variants: sizeVariant(sizesXL),
    sku: 'SL-SWT-MRN-018',
    imageUrl: img('sl-swt-mrn-018'),
  },
  {
    name: 'Cotton Terry Shorts',
    description: 'Relaxed-fit terry shorts in grey, elastic drawstring waist, side pockets.',
    category: 'Shorts',
    price: { amount: 899, currency: 'INR' },
    stock: 40,
    variants: sizeVariant(sizesXL),
    sku: 'SL-SHO-GRY-019',
    imageUrl: img('sl-sho-gry-019'),
  },
  {
    name: 'Ribbed Knit Sweater - Camel',
    description: 'Fine-gauge ribbed sweater in camel, crew neck, regular fit.',
    category: 'Sweaters',
    price: { amount: 2299, currency: 'INR' },
    stock: 14,
    variants: sizeVariant(sizesXL),
    sku: 'SL-SWE-CML-020',
    imageUrl: img('sl-swe-cml-020'),
  },
]

async function seed(): Promise<void> {
  if (!config.mongodbUri) {
    console.error('[seed] MONGODB_URI is not set — add it to server/.env before seeding.')
    process.exit(1)
  }

  await mongoose.connect(config.mongodbUri)
  console.log('[seed] Connected to MongoDB')

  await Product.deleteMany({})
  console.log('[seed] Cleared existing products')

  const inserted = await Product.insertMany(products)
  console.log(`[seed] Inserted ${inserted.length} products`)

  await mongoose.disconnect()
  console.log('[seed] Done')
}

seed().catch((err) => {
  console.error('[seed] Failed:', err)
  process.exit(1)
})
