import { useState } from 'react'
import { BuyerAgentConsole } from '../components/BuyerAgentConsole'
import { AuditTrail } from '../components/AuditTrail'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

export function Dashboard() {
  const [orderId, setOrderId] = useState<string | undefined>(undefined)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title="Buyer agent">
        <BuyerAgentConsole onOrderCreated={setOrderId} />
      </Card>

      <Card
        title="Audit trail"
        action={
          orderId ? (
            <Button variant="ghost" size="sm" onClick={() => setOrderId(undefined)}>
              Show all activity
            </Button>
          ) : undefined
        }
      >
        {orderId && (
          <p className="mb-3 font-mono text-[11px] text-dust">
            scoped to order <span className="text-thread">{orderId}</span>
          </p>
        )}
        <AuditTrail orderId={orderId} />
      </Card>
    </div>
  )
}
