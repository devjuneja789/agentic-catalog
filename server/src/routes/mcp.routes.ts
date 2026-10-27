import { Router, Request, Response } from 'express'
import { MCP_MANIFEST, MCP_TOOLS, executeMcpTool } from '../mcp/manifest'

const router = Router()

/**
 * GET /api/mcp
 * GET /api/mcp/manifest
 * Returns the full Model Context Protocol (MCP) server manifest.
 */
router.get(['/', '/manifest'], (_req: Request, res: Response) => {
  res.json(MCP_MANIFEST)
})

/**
 * GET /api/mcp/tools
 * Returns the list of tools adhering to the MCP schema.
 */
router.get('/tools', (_req: Request, res: Response) => {
  res.json({
    tools: MCP_TOOLS,
    count: MCP_TOOLS.length,
  })
})

/**
 * POST /api/mcp/tools/:toolName
 * Direct invocation of an MCP tool by external agents.
 */
router.post('/tools/:toolName', async (req: Request, res: Response) => {
  const { toolName } = req.params
  const args = req.body?.arguments || req.body || {}

  try {
    const { result, isError } = await executeMcpTool(toolName, args)
    res.status(isError ? 400 : 200).json({
      tool: toolName,
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        },
      ],
      isError: !!isError,
      raw: result,
    })
  } catch (err: any) {
    res.status(500).json({
      tool: toolName,
      content: [
        {
          type: 'text',
          text: err.message || 'Internal MCP tool execution failure',
        },
      ],
      isError: true,
    })
  }
})

/**
 * POST /api/mcp/execute
 * Standard JSON-RPC or tool runner format: { "tool": "search_catalog", "arguments": { ... } }
 */
router.post('/execute', async (req: Request, res: Response) => {
  const toolName = req.body?.tool || req.body?.name
  const args = req.body?.arguments || {}

  if (!toolName) {
    res.status(400).json({
      isError: true,
      content: [{ type: 'text', text: 'Missing required field "tool" or "name"' }],
    })
    return
  }

  try {
    const { result, isError } = await executeMcpTool(toolName, args)
    res.status(isError ? 400 : 200).json({
      tool: toolName,
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        },
      ],
      isError: !!isError,
      raw: result,
    })
  } catch (err: any) {
    res.status(500).json({
      tool: toolName,
      content: [
        {
          type: 'text',
          text: err.message || 'Internal MCP tool execution failure',
        },
      ],
      isError: true,
    })
  }
})

export default router
