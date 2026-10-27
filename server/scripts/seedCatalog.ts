import mongoose from 'mongoose'
import { config } from '../src/config/env'
import { IProduct, Product } from '../src/models/Product'

const sizesXL: string[] = ['S', 'M', 'L', 'XL']
const sizesXXL: string[] = ['S', 'M', 'L', 'XL', 'XXL']

const sizeVariant = (options: string[]) => [{ name: 'Size', options }]

// Curated high quality Unsplash fashion photography corresponding directly to each item
const products: IProduct[] = [
  {
    name: 'Classic Black Hoodie',
    description: 'Heavyweight cotton-fleece hoodie with a relaxed fit, kangaroo pocket, and ribbed cuffs.',
    category: 'Hoodies',
    price: { amount: 1499, currency: 'INR' },
    stock: 42,
    variants: sizeVariant(sizesXL),
    sku: 'SL-HOD-BLK-001',
    imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Charcoal Grey Hoodie',
    description: 'Brushed-fleece hoodie in charcoal grey, drawstring hood, dropped shoulder seams.',
    category: 'Hoodies',
    price: { amount: 1599, currency: 'INR' },
    stock: 30,
    variants: sizeVariant(sizesXL),
    sku: 'SL-HOD-CHR-002',
    imageUrl: 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Essential White Tee',
    description: '220 GSM combed cotton tee, boxy fit, pre-shrunk, everyday basic.',
    category: 'T-Shirts',
    price: { amount: 699, currency: 'INR' },
    stock: 80,
    variants: sizeVariant(sizesXXL),
    sku: 'SL-TEE-WHT-003',
    imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Essential Black Tee',
    description: '220 GSM combed cotton tee, boxy fit, pre-shrunk, everyday basic.',
    category: 'T-Shirts',
    price: { amount: 699, currency: 'INR' },
    stock: 75,
    variants: sizeVariant(sizesXXL),
    sku: 'SL-TEE-BLK-004',
    imageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Sage Green Oversized Tee',
    description: 'Oversized fit tee in sage green with dropped shoulders and a heavy 260 GSM knit.',
    category: 'T-Shirts',
    price: { amount: 799, currency: 'INR' },
    stock: 25,
    variants: sizeVariant(sizesXXL),
    sku: 'SL-TEE-SGE-005',
    imageUrl: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Raw Indigo Selvedge Denim',
    description: '14oz Japanese raw selvedge denim, straight leg, button fly, copper rivets.',
    category: 'Jeans',
    price: { amount: 3499, currency: 'INR' },
    stock: 18,
    variants: sizeVariant(['30', '32', '34', '36']),
    sku: 'SL-JNS-IND-006',
    imageUrl: 'https://images.unsplash.com/photo-1542272604-780c96856592?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Washed Black Slim Jeans',
    description: 'Stretch denim in washed vintage black, slim-tapered silhouette.',
    category: 'Jeans',
    price: { amount: 2799, currency: 'INR' },
    stock: 35,
    variants: sizeVariant(['30', '32', '34', '36']),
    sku: 'SL-JNS-BLK-007',
    imageUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Utility Cargo Pants - Olive',
    description: 'Ripstop cotton cargo trousers, articulated knees, drawstring hem, 6-pocket build.',
    category: 'Pants',
    price: { amount: 2499, currency: 'INR' },
    stock: 22,
    variants: sizeVariant(sizesXL),
    sku: 'SL-CAR-OLV-008',
    imageUrl: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Pleated Chino - Khaki',
    description: 'Single-pleat tailored chinos in mid-weight cotton twill with a tapered cut.',
    category: 'Pants',
    price: { amount: 2199, currency: 'INR' },
    stock: 28,
    variants: sizeVariant(sizesXL),
    sku: 'SL-PNT-KHK-009',
    imageUrl: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Canvas Chore Jacket - Tan',
    description: 'Heavyweight canvas chore coat with brass buttons, three patch pockets, unlined.',
    category: 'Jackets',
    price: { amount: 2499, currency: 'INR' },
    stock: 0, // Configured for Zero-Stock recovery test scenario
    variants: sizeVariant(sizesXL),
    sku: 'SL-JKT-TAN-010',
    imageUrl: 'https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Nylon Bomber Jacket - Black',
    description: 'Water-resistant flight bomber with ribbed baseball collar and two-way zip.',
    category: 'Jackets',
    price: { amount: 3999, currency: 'INR' },
    stock: 12,
    variants: sizeVariant(sizesXL),
    sku: 'SL-JKT-BLK-011',
    imageUrl: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Flannel Overshirt - Plaid Navy',
    description: 'Brushed twill flannel shirt jacket with twin chest pockets, pearl snap buttons.',
    category: 'Shirts',
    price: { amount: 1899, currency: 'INR' },
    stock: 34,
    variants: sizeVariant(sizesXL),
    sku: 'SL-OVS-NVY-012',
    imageUrl: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Oxford Cloth Button Down - Blue',
    description: 'Classic 100% Oxford cotton shirt with button-down collar, regular fit.',
    category: 'Shirts',
    price: { amount: 1699, currency: 'INR' },
    stock: 45,
    variants: sizeVariant(sizesXL),
    sku: 'SL-OCB-BLU-013',
    imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Minimalist Leather Sneakers - White',
    description: 'Full-grain calf leather low-tops with Margom rubber sole and waxed cotton laces.',
    category: 'Footwear',
    price: { amount: 4499, currency: 'INR' },
    stock: 16,
    variants: sizeVariant(['40', '41', '42', '43', '44', '45']),
    sku: 'SL-SNK-WHT-014',
    imageUrl: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Designer Suede Jacket - Espresso',
    description: 'Handcrafted Italian suede jacket with brass YKK hardware and silk lining.',
    category: 'Jackets',
    price: { amount: 14999, currency: 'INR' }, // Hits approval gate (> 10,000 threshold)
    stock: 8,
    variants: sizeVariant(sizesXL),
    sku: 'SL-JKT-SDE-015',
    imageUrl: 'https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Suede Chelsea Boots - Sand',
    description: 'Italian suede boots with elastic side gussets, pull tabs, and crepe sole.',
    category: 'Footwear',
    price: { amount: 5999, currency: 'INR' },
    stock: 10,
    variants: sizeVariant(['40', '41', '42', '43', '44', '45']),
    sku: 'SL-BOT-SND-016',
    imageUrl: 'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Heavyweight Zip Hoodie - Heather Grey',
    description: '450 GSM reverse-weave zip hoodie with YKK dual zipper and thermal lining.',
    category: 'Hoodies',
    price: { amount: 1899, currency: 'INR' },
    stock: 24,
    variants: sizeVariant(sizesXL),
    sku: 'SL-HOD-GRY-017',
    imageUrl: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Crew Neck Sweatshirt - Maroon',
    description: 'Fleece-lined crew neck sweatshirt in maroon, ribbed hem and cuffs.',
    category: 'Sweatshirts',
    price: { amount: 1499, currency: 'INR' },
    stock: 24,
    variants: sizeVariant(sizesXL),
    sku: 'SL-SWT-MRN-018',
    imageUrl: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Ribbed Knit Sweater - Camel',
    description: 'Fine-gauge ribbed sweater in camel, crew neck, regular fit.',
    category: 'Sweaters',
    price: { amount: 2699, currency: 'INR' },
    stock: 14,
    variants: sizeVariant(sizesXL),
    sku: 'SL-SWE-CML-019',
    imageUrl: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Bespoke Royal Silk Ensemble',
    description: 'Hand-embroidered gold zardozi pure Banarasi silk ceremonial jacket and churidar ensemble.',
    category: 'Suits',
    price: { amount: 65000, currency: 'INR' }, // Hits hard safety cap (> 50,000 threshold)
    stock: 3,
    variants: sizeVariant(sizesXL),
    sku: 'SL-ENS-SLK-020',
    imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80',
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
