import { CatalogTable } from '../components/CatalogTable'
import { Card } from '../components/ui/Card'

export function CatalogAdmin() {
  return (
    <Card title="Catalog">
      <p className="mb-4 text-sm text-dust">
        Edit price or stock inline — changes save on blur or Enter. Zeroing a product's stock is the fastest way to trigger{' '}
        <span className="font-mono text-rust">OUT_OF_STOCK</span> on the next checkout attempt.
      </p>
      <CatalogTable />
    </Card>
  )
}
