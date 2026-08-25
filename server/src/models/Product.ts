import { Schema, model } from 'mongoose'

export interface ProductPrice {
  amount: number
  currency: string
}

export interface ProductVariant {
  name: string // e.g. "Size"
  options: string[] // e.g. ["S", "M", "L", "XL"]
}

export interface IProduct {
  name: string
  description: string
  category: string
  price: ProductPrice
  stock: number
  variants: ProductVariant[]
  sku: string
  imageUrl: string
}

const priceSchema = new Schema<ProductPrice>(
  {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'INR' },
  },
  { _id: false },
)

const variantSchema = new Schema<ProductVariant>(
  {
    name: { type: String, required: true },
    options: { type: [String], required: true, default: [] },
  },
  { _id: false },
)

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true, trim: true, index: true },
    price: { type: priceSchema, required: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
    variants: { type: [variantSchema], default: [] },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    imageUrl: { type: String, required: true },
  },
  { timestamps: true },
)

// Backs the `q` param on GET /api/catalog/search
productSchema.index({ name: 'text', description: 'text', category: 'text' })

export const Product = model<IProduct>('Product', productSchema)
