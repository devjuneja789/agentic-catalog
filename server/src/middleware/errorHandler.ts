import { NextFunction, Request, Response } from 'express'

export interface ApiError extends Error {
  status?: number
  code?: string
}

// Structured error responses. Phase 4 extends this with specific failure
// shapes like { error: "OUT_OF_STOCK", productId }.
export function errorHandler(err: ApiError, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[error]', err)
  const status = err.status ?? 500
  res.status(status).json({
    error: {
      message: err.message ?? 'Internal server error',
      code: err.code ?? 'INTERNAL_ERROR',
    },
  })
}
