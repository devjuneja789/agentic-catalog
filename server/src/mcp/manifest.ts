import { Product } from '../models/Product'
import { Order } from '../models/Order'
import { AuditLog } from '../models/AuditLog'
import { verifyProduct, releaseStock } from '../services/verification.service'
import { evaluateGuardrails } from '../services/guardrails.service'
import { createPaymentLinkWithRetry } from '../services/razorpay.service'
import { logAudit } from '../services/audit.service'
import { runBuyerAgentFlow } from '../agent/buyerAgentFlow'
import { config } from '../config/env'

export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  metadata: {
    endpoint: string
    method: 'GET' | 'POST' | 'PATCH'
    category: 'catalog' | 'checkout' | 'guardrails' | 'agent' | 'audit'
  }
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'search_catalog',
    description:
      'Search the Studio Loom apparel catalog by text query, category, and budget. Returns live stock levels, pricing in INR, and product IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keywords, e.g. "hoodie", "sneakers", "jacket", "kurta"',
        },
        category: {
          type: 'string',
          description: 'Category filter, e.g. "Hoodies", "T-Shirts", "Shirts", "Jackets", "Kurtas"',
        },
        maxPrice: {
          type: 'number',
          description: 'Maximum allowable unit price in INR (₹)',
        },
        inStockOnly: {
          type: 'boolean',
          description: 'If true, excludes products with 0 stock',
        },
      },
    },
    metadata: {
      endpoint: '/api/catalog/search',
      method: 'GET',
      category: 'catalog',
    },
  },
  {
    name: 'get_product_details',
    description:
      'Query real-time stock levels, pricing, SKU, description, and atomic reservation availability for a specific product ID.',
    inputSchema: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'MongoDB ObjectId of the target product',
        },
      },
      required: ['productId'],
    },
    metadata: {
      endpoint: '/api/catalog/:id',
      method: 'GET',
      category: 'catalog',
    },
  },
  {
    name: 'create_guarded_checkout',
    description:
      'Execute a safe, guarded purchase order. Atomically locks stock in MongoDB and enforces spending limits: auto-approved creates Razorpay Payment Link; threshold creates human review hold; over maximum hard cap is rejected.',
    inputSchema: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'MongoDB ObjectId of the product to purchase',
        },
        quantity: {
          type: 'number',
          description: 'Number of units to purchase (default 1)',
        },
        customerName: {
          type: 'string',
          description: 'Full name or identifier of the customer placing the order',
        },
        customerEmail: {
          type: 'string',
          description: 'Email of the customer for Razorpay payment link delivery',
        },
        customerContact: {
          type: 'string',
          description: 'Phone number of customer (e.g. "+919876543210")',
        },
        quotedPrice: {
          type: 'number',
          description: 'Expected unit price in INR to guard against concurrent price updates',
        },
      },
      required: ['productId', 'customerName'],
    },
    metadata: {
      endpoint: '/api/checkout/:productId',
      method: 'POST',
      category: 'checkout',
    },
  },
  {
    name: 'run_gemini_buyer_agent',
    description:
      'Autonomous shopping agent powered by Gemini AI. Parses natural language intent, searches catalog, acquires atomic stock lock, and generates Razorpay payment link.',
    inputSchema: {
      type: 'object',
      properties: {
        want: {
          type: 'string',
          description: 'Natural language shopping request, e.g. "Black hoodie under 2000 rupees"',
        },
        customerName: {
          type: 'string',
          description: 'Name of customer placing the order',
        },
      },
      required: ['want', 'customerName'],
    },
    metadata: {
      endpoint: '/api/agent/buy',
      method: 'POST',
      category: 'agent',
    },
  },
  {
    name: 'inspect_audit_trail',
    description:
      'Fetch the append-only audit trail recording every autonomous agent decision, stock reservation lock, guardrail gate, and Razorpay payment event.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'Filter audit records by specific Order ID',
        },
        limit: {
          type: 'number',
          description: 'Max number of records to return (default 20, max 100)',
        },
      },
    },
    metadata: {
      endpoint: '/api/audit',
      method: 'GET',
      category: 'audit',
    },
  },
  {
    name: 'manage_pending_approval',
    description:
      'Store manager action to list, approve, or deny orders flagged by autonomous spending guardrails.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: '"list" (view pending orders), "approve" (authorize & generate Razorpay link), or "deny" (reject & release stock)',
        },
        orderId: {
          type: 'string',
          description: 'Target Order ID (required when action is "approve" or "deny")',
        },
        reason: {
          type: 'string',
          description: 'Optional administrative reasoning note for denial',
        },
      },
      required: ['action'],
    },
    metadata: {
      endpoint: '/api/checkout/pending',
      method: 'POST',
      category: 'guardrails',
    },
  },
]

export const MCP_MANIFEST = {
  protocol: 'model-context-protocol',
  version: '2024-11-05',
  server: {
    name: 'studio-loom-razorpay-mcp',
    version: '2.0.0',
    description:
      'Studio Loom Autonomous Commerce Engine — Razorpay Payment Links, Atomic Stock Locks, Spending Guardrails & Gemini AI.',
    repository: 'https://github.com/studio-loom/agentic-catalog',
    author: 'Studio Loom Engineering',
  },
  capabilities: {
    tools: true,
    prompts: true,
    resources: true,
    sampling: false,
  },
  tools: MCP_TOOLS,
  prompts: [
    {
      name: 'autonomous_purchase',
      description: 'Instruct an external agent to fulfill a customer shopping request safely within budget.',
      arguments: [
        { name: 'intent', description: 'What the customer wants to buy', required: true },
        { name: 'maxBudget', description: 'Hard spending limit in INR (₹)', required: true },
        { name: 'customerName', description: 'Name of the shopper', required: true },
      ],
    },
    {
      name: 'audit_verification',
      description: 'Audit the end-to-end cryptographic and guardrail lifecycle for a given transaction.',
      arguments: [
        { name: 'orderId', description: 'Order ID to verify', required: true },
      ],
    },
  ],
  resources: [
    {
      uri: 'catalog://inventory',
      name: 'Live Catalog Inventory Snapshot',
      mimeType: 'application/json',
      description: 'Real-time feed of current active products, pricing in INR, and available stock units.',
    },
    {
      uri: 'guardrails://policy',
      name: 'Spending Guardrail Ruleset',
      mimeType: 'application/json',
      description: `Active thresholds: Auto-approve limit (₹${config.guardrails.approvalThreshold}), Hard safety cap (₹${config.guardrails.maxOrderValue}).`,
    },
  ],
  sampleConfig: {
    claudeDesktop: {
      mcpServers: {
        'studio-loom-razorpay': {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-fetch', `http://localhost:${config.port}/api/mcp`],
        },
      },
    },
  },
}

/**
 * Direct execution dispatcher for MCP tool calls.
 * Used when an external agent invokes POST /api/mcp/tools/:toolName or POST /api/mcp/execute
 */
export async function executeMcpTool(
  toolName: string,
  args: Record<string, any> = {},
): Promise<{ result: any; isError?: boolean }> {
  const actor = 'mcp-agent'

  switch (toolName) {
    case 'search_catalog': {
      const filter: Record<string, unknown> = {}
      if (args.query && typeof args.query === 'string' && args.query.trim()) {
        const regex = new RegExp(args.query.trim(), 'i')
        filter.$or = [{ name: regex }, { description: regex }, { category: regex }]
      }
      if (args.category && typeof args.category === 'string' && args.category.trim()) {
        filter.category = new RegExp(`^${args.category.trim()}$`, 'i')
      }
      if (args.maxPrice && typeof args.maxPrice === 'number') {
        filter['price.amount'] = { $lte: args.maxPrice }
      }
      if (args.inStockOnly) {
        filter.stock = { $gt: 0 }
      }

      const products = await Product.find(filter).sort({ createdAt: -1 })
      return {
        result: {
          count: products.length,
          products: products.map((p) => ({
            id: p._id.toString(),
            sku: p.sku,
            name: p.name,
            price: p.price.amount,
            currency: p.price.currency,
            stock: p.stock,
            category: p.category,
          })),
        },
      }
    }

    case 'get_product_details': {
      if (!args.productId) {
        return { isError: true, result: { error: 'productId is required' } }
      }
      const product = await Product.findById(args.productId)
      if (!product) {
        return { isError: true, result: { error: 'Product not found' } }
      }
      return {
        result: {
          id: product._id.toString(),
          sku: product.sku,
          name: product.name,
          description: product.description,
          price: product.price.amount,
          currency: product.price.currency,
          stock: product.stock,
          category: product.category,
          imageUrl: product.imageUrl,
        },
      }
    }

    case 'create_guarded_checkout': {
      const { productId, quantity = 1, customerName, customerEmail, customerContact, quotedPrice } = args
      if (!productId || !customerName) {
        return { isError: true, result: { error: 'productId and customerName are required' } }
      }

      const verification = await verifyProduct(productId, quantity, quotedPrice)
      if (!verification.ok) {
        return {
          isError: true,
          result: {
            error: verification.code,
            message: verification.message,
            details: verification.details,
          },
        }
      }

      const verified = verification.product
      const amount = verified.price.amount * quantity
      const guardrail = evaluateGuardrails(amount)

      if (guardrail.decision === 'rejected') {
        await releaseStock(verified.id, quantity)
        return {
          isError: true,
          result: {
            error: 'GUARDRAIL_REJECTED',
            reason: guardrail.reasoning,
          },
        }
      }

      if (guardrail.decision === 'pending_approval') {
        const order = await Order.create({
          status: 'pending_approval',
          amount,
          currency: verified.price.currency,
          quantity,
          product: {
            productId: verified.id,
            sku: verified.sku,
            name: verified.name,
            imageUrl: verified.imageUrl,
            unitPrice: { amount: verified.price.amount, currency: verified.price.currency },
          },
          actor,
          customerName,
          guardrailDecision: guardrail.decision,
          guardrailReasoning: guardrail.reasoning,
        })

        return {
          result: {
            status: 'pending_approval',
            orderId: order._id.toString(),
            message: `Order held in human review queue (₹${config.guardrails.approvalThreshold} threshold). Stock is locked.`,
            guardrailReason: guardrail.reasoning,
          },
        }
      }

      // Auto-approved path: create Razorpay Payment Link
      const order = await Order.create({
        status: 'awaiting_payment',
        amount,
        currency: verified.price.currency,
        quantity,
        product: {
          productId: verified.id,
          sku: verified.sku,
          name: verified.name,
          imageUrl: verified.imageUrl,
          unitPrice: { amount: verified.price.amount, currency: verified.price.currency },
        },
        actor,
        customerName,
        guardrailDecision: guardrail.decision,
        guardrailReasoning: guardrail.reasoning,
      })

      const paymentLink = await createPaymentLinkWithRetry({
        referenceId: order._id.toString(),
        amount: order.amount,
        currency: order.currency || 'INR',
        description: `${verified.name} x${quantity}`,
        notes: {
          productId: verified.id.toString(),
          sku: verified.sku,
          orderId: order._id.toString(),
        },
        customer: {
          name: customerName,
          email: customerEmail,
          contact: customerContact,
        },
      })

      order.razorpay = {
        paymentLinkId: paymentLink.id,
        paymentLinkUrl: paymentLink.shortUrl,
        status: paymentLink.status,
      }
      await order.save()

      return {
        result: {
          status: 'awaiting_payment',
          orderId: order._id.toString(),
          paymentLinkId: paymentLink.id,
          paymentLink: paymentLink.shortUrl,
          paymentLinkUrl: paymentLink.shortUrl,
          amount: order.amount,
          currency: order.currency,
        },
      }
    }

    case 'run_gemini_buyer_agent': {
      const { want, customerName } = args
      if (!want || !customerName) {
        return { isError: true, result: { error: 'want and customerName are required' } }
      }
      const apiBase = `http://localhost:${config.port}/api`
      const agentResult = await runBuyerAgentFlow(want, apiBase, undefined, { name: customerName })
      return { result: agentResult }
    }

    case 'inspect_audit_trail': {
      const filter: Record<string, unknown> = {}
      if (args.orderId) filter.orderId = args.orderId
      const limit = Math.min(Number(args.limit) || 20, 100)
      const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit)
      return { result: { count: logs.length, records: logs } }
    }

    case 'manage_pending_approval': {
      const { action, orderId, reason } = args
      if (action === 'list') {
        const orders = await Order.find({ status: 'pending_approval' }).sort({ createdAt: -1 })
        return { result: { count: orders.length, orders } }
      }

      if (action === 'approve') {
        if (!orderId) return { isError: true, result: { error: 'orderId is required' } }
        const order = await Order.findById(orderId)
        if (!order) return { isError: true, result: { error: 'Order not found' } }
        if (order.status !== 'pending_approval') {
          return { isError: true, result: { error: `Order is in status: ${order.status}` } }
        }

        const paymentLink = await createPaymentLinkWithRetry({
          referenceId: order._id.toString(),
          amount: order.amount,
          currency: order.currency || 'INR',
          description: `${order.product.name} x${order.quantity}`,
          notes: {
            productId: order.product.productId.toString(),
            sku: order.product.sku,
            orderId: order._id.toString(),
          },
        })

        order.status = 'awaiting_payment'
        order.razorpay = {
          paymentLinkId: paymentLink.id,
          paymentLinkUrl: paymentLink.shortUrl,
          status: paymentLink.status,
        }
        await order.save()

        await logAudit({
          actor: 'mcp-manager',
          action: 'gate',
          decision: 'approved_by_admin',
          reasoning: 'Order manually approved via MCP tool execution.',
          orderId: order._id,
          result: { paymentLinkId: paymentLink.id, paymentLinkUrl: paymentLink.shortUrl },
        })

        return {
          result: {
            status: 'awaiting_payment',
            orderId: order._id.toString(),
            paymentLinkId: paymentLink.id,
            paymentLink: paymentLink.shortUrl,
            paymentLinkUrl: paymentLink.shortUrl,
          },
        }
      }

      if (action === 'deny') {
        if (!orderId) return { isError: true, result: { error: 'orderId is required' } }
        const order = await Order.findById(orderId)
        if (!order) return { isError: true, result: { error: 'Order not found' } }
        if (order.status !== 'pending_approval') {
          return { isError: true, result: { error: `Order is in status: ${order.status}` } }
        }

        await releaseStock(order.product.productId, order.quantity)
        order.status = 'rejected'
        order.rejectionReason = reason || 'Order rejected via MCP tool execution.'
        await order.save()

        await logAudit({
          actor: 'mcp-manager',
          action: 'gate',
          decision: 'denied_by_admin',
          reasoning: reason || 'Order rejected via MCP tool execution.',
          orderId: order._id,
        })

        return {
          result: {
            status: 'rejected',
            orderId: order._id.toString(),
            message: 'Order denied and reserved stock returned to catalog.',
          },
        }
      }

      return { isError: true, result: { error: `Unknown action: ${action}` } }
    }

    default:
      return { isError: true, result: { error: `Tool not found: ${toolName}` } }
  }
}
