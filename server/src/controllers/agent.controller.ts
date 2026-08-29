import { NextFunction, Request, Response } from 'express'
import { runBuyerAgentFlow } from '../agent/buyerAgentFlow'
import { config } from '../config/env'

interface RunAgentRequestBody {
  want?: string
}

// POST /api/agent/buy
// Lets the dashboard trigger the exact same flow as the CLI script — it
// calls this server's own public /catalog/search and /checkout endpoints
// over real HTTP, so whether the agent is run from a terminal or a browser
// button, it's exercising the same public API surface an external agent would.
export async function runBuyerAgent(
  req: Request<unknown, unknown, RunAgentRequestBody>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const want = req.body.want?.trim()

    if (!want) {
      res.status(400).json({ error: { message: '"want" is required', code: 'MISSING_WANT' } })
      return
    }

    const apiBase = `http://localhost:${config.port}/api`
    const result = await runBuyerAgentFlow(want, apiBase)

    res.json(result)
  } catch (err) {
    next(err)
  }
}
