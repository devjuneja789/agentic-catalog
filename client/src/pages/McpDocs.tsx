import { useEffect, useState } from 'react'
import { getMcpManifest, executeMcpToolCall } from '../api/client'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge, type Tone } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'

const SAMPLE_PAYLOADS: Record<string, string> = {
  search_catalog: JSON.stringify(
    {
      query: 'hoodie',
      maxPrice: 2000,
      inStockOnly: true,
    },
    null,
    2,
  ),
  get_product_details: JSON.stringify(
    {
      productId: '6745f1b2c45e8b0012345678',
    },
    null,
    2,
  ),
  create_guarded_checkout: JSON.stringify(
    {
      productId: '6745f1b2c45e8b0012345678',
      quantity: 1,
      customerName: 'Autonomous Agent #1',
      customerContact: '+919876543210',
    },
    null,
    2,
  ),
  run_gemini_buyer_agent: JSON.stringify(
    {
      want: 'Black hoodie under 2000 rupees',
      customerName: 'Alex Chen',
    },
    null,
    2,
  ),
  inspect_audit_trail: JSON.stringify(
    {
      limit: 5,
    },
    null,
    2,
  ),
  manage_pending_approval: JSON.stringify(
    {
      action: 'list',
    },
    null,
    2,
  ),
}

export function McpDocs() {
  const [manifest, setManifest] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Interactive Tester state
  const [selectedTool, setSelectedTool] = useState('search_catalog')
  const [toolInputJson, setToolInputJson] = useState(SAMPLE_PAYLOADS.search_catalog)
  const [running, setRunning] = useState(false)
  const [toolResult, setToolResult] = useState<any>(null)
  const [copiedConfig, setCopiedConfig] = useState(false)

  useEffect(() => {
    getMcpManifest()
      .then((data) => {
        setManifest(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || 'Failed to load MCP manifest.')
        setLoading(false)
      })
  }, [])

  function handleSelectTool(name: string) {
    setSelectedTool(name)
    setToolInputJson(SAMPLE_PAYLOADS[name] || '{}')
    setToolResult(null)
  }

  async function handleExecuteTool() {
    let parsedArgs = {}
    try {
      parsedArgs = JSON.parse(toolInputJson)
    } catch {
      alert('Invalid JSON input syntax.')
      return
    }

    setRunning(true)
    setToolResult(null)
    const startTime = performance.now()
    try {
      const res = await executeMcpToolCall(selectedTool, parsedArgs)
      const elapsed = Math.round(performance.now() - startTime)
      setToolResult({ ...res, elapsedMs: elapsed })
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime)
      setToolResult({
        isError: true,
        content: [{ type: 'text', text: err.message || 'Execution failed' }],
        elapsedMs: elapsed,
      })
    } finally {
      setRunning(false)
    }
  }

  const claudeConfigSnippet = JSON.stringify(
    {
      mcpServers: {
        'studio-loom-razorpay': {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-fetch', 'http://localhost:5000/api/mcp'],
        },
      },
    },
    null,
    2,
  )

  function copyConfig() {
    navigator.clipboard.writeText(claudeConfigSnippet)
    setCopiedConfig(true)
    setTimeout(() => setCopiedConfig(false), 2500)
  }

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="rounded-2xl border border-dust/15 bg-surface p-6 sm:p-8 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-thread/20 font-mono text-xs font-bold text-thread border border-thread/40">
                ⚡
              </span>
              <h2 className="text-xl font-bold tracking-tight text-linen sm:text-2xl">
                Model Context Protocol (MCP) Hub
              </h2>
              <span className="rounded-md border border-sage/30 bg-sage/10 px-2 py-0.5 font-mono text-[11px] text-sage">
                v2024-11-05 Ready
              </span>
            </div>
            <p className="max-w-3xl text-sm text-dust">
              Studio Loom is designed as an agent-ready commerce backend. Any external AI agent
              (Claude Desktop, Cursor, OpenAI Swarm, or Gemini agents) can discover these MCP tools
              to autonomously query apparel inventory, verify stock locks, and initiate safe Razorpay test checkouts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="http://localhost:5000/api/mcp/manifest"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-dust/20 bg-surface-raised px-4 py-2 font-mono text-xs text-linen transition hover:border-thread/40"
            >
              <svg className="h-4 w-4 text-thread" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Raw Manifest
            </a>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-20 text-sm text-dust">
          <Spinner /> Inspecting MCP server tools...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rust/30 bg-rust/10 p-6 text-center text-sm text-rust">
          {error}
        </div>
      )}

      {!loading && manifest && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column: Interactive MCP Tool Tester (7 cols) */}
          <div className="space-y-6 lg:col-span-7">
            <Card
              title={
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-thread" />
                  <span>Interactive MCP Tool Runner</span>
                </div>
              }
            >
              <div className="space-y-4">
                <p className="text-xs text-dust">
                  Select an MCP tool and dispatch an execution request directly over <code className="font-mono text-linen">POST /api/mcp/tools/:toolName</code>.
                </p>

                {/* Tool Selector Buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {manifest.tools.map((t: any) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => handleSelectTool(t.name)}
                      className={`rounded-lg px-2.5 py-1 font-mono text-xs transition ${
                        selectedTool === t.name
                          ? 'border border-thread bg-thread/20 text-thread shadow-sm'
                          : 'border border-dust/15 bg-surface-raised text-dust hover:text-linen'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>

                {/* Active Tool Schema Description */}
                {manifest.tools.find((t: any) => t.name === selectedTool) && (
                  <div className="rounded-lg border border-dust/15 bg-ink p-3 text-xs text-linen">
                    <div className="flex items-center justify-between font-mono text-[11px] text-thread">
                      <span>Method: {manifest.tools.find((t: any) => t.name === selectedTool).metadata.method}</span>
                      <span>Endpoint: {manifest.tools.find((t: any) => t.name === selectedTool).metadata.endpoint}</span>
                    </div>
                    <p className="mt-1 text-dust">
                      {manifest.tools.find((t: any) => t.name === selectedTool).description}
                    </p>
                  </div>
                )}

                {/* Input Payload Editor */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-linen">
                    <span>Arguments (JSON)</span>
                    <button
                      type="button"
                      onClick={() => setToolInputJson(SAMPLE_PAYLOADS[selectedTool] || '{}')}
                      className="font-mono text-[11px] text-thread hover:underline"
                    >
                      Reset Preset
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={toolInputJson}
                    onChange={(e) => setToolInputJson(e.target.value)}
                    className="w-full rounded-xl border border-dust/20 bg-ink p-3 font-mono text-xs text-linen focus:border-thread focus:outline-none"
                  />
                </div>

                <Button
                  variant="primary"
                  onClick={handleExecuteTool}
                  disabled={running}
                  loading={running}
                  className="w-full"
                >
                  Execute Tool via MCP
                </Button>

                {/* Response Output Box */}
                {toolResult && (
                  <div className="mt-4 rounded-xl border border-dust/20 bg-ink p-4">
                    <div className="mb-2 flex items-center justify-between border-b border-dust/10 pb-2 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            toolResult.isError ? 'bg-rust' : 'bg-sage'
                          }`}
                        />
                        <span className={toolResult.isError ? 'text-rust' : 'text-sage'}>
                          {toolResult.isError ? 'Execution Error' : '200 OK — Tool Call Succeeded'}
                        </span>
                      </div>
                      <span className="text-dust">{toolResult.elapsedMs}ms</span>
                    </div>
                    <pre className="max-h-64 overflow-x-auto overflow-y-auto font-mono text-xs leading-relaxed text-linen">
                      {toolResult.content?.[0]?.text || JSON.stringify(toolResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </Card>

            {/* Quick Setup for Claude Desktop */}
            <Card
              title={
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-dust">01</span>
                  <span>Claude Desktop Configuration</span>
                </div>
              }
              action={
                <Button variant="ghost" size="sm" onClick={copyConfig}>
                  {copiedConfig ? '✓ Copied!' : 'Copy JSON'}
                </Button>
              }
            >
              <p className="mb-3 text-xs text-dust">
                Paste this into your <code className="rounded bg-surface-raised px-1 py-0.5 font-mono text-linen">claude_desktop_config.json</code> to give Claude direct access to your catalog and safe Razorpay checkout:
              </p>
              <pre className="overflow-x-auto rounded-xl border border-dust/15 bg-ink p-3.5 font-mono text-xs text-linen">
                {claudeConfigSnippet}
              </pre>
            </Card>
          </div>

          {/* Right Column: Complete Tool Definitions & Schema (5 cols) */}
          <div className="space-y-4 lg:col-span-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-linen">Registered MCP Tools ({manifest.tools.length})</h3>
              <span className="font-mono text-xs text-dust">JSON Schema v7</span>
            </div>

            <div className="space-y-3">
              {manifest.tools.map((t: any) => {
                const toneMap: Record<string, Tone> = {
                  checkout: 'warning',
                  agent: 'info',
                  audit: 'neutral',
                  catalog: 'success',
                  guardrails: 'warning',
                }
                const categoryTone = toneMap[t.metadata.category] || 'neutral'

                return (
                  <div
                    key={t.name}
                    className="rounded-xl border border-dust/15 bg-surface p-4 transition-all hover:border-dust/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-linen">{t.name}</span>
                        <Badge tone={categoryTone}>{t.metadata.category}</Badge>
                      </div>
                      <span className="font-mono text-[10px] text-dust">
                        {t.metadata.method} {t.metadata.endpoint}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-dust leading-relaxed">
                      {t.description}
                    </p>

                    {/* Parameters summary */}
                    <div className="mt-3 border-t border-dust/10 pt-2.5">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-dust">
                        Arguments Schema:
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.keys(t.inputSchema.properties || {}).map((prop) => {
                          const isReq = (t.inputSchema.required || []).includes(prop)
                          const type = t.inputSchema.properties[prop].type
                          return (
                            <span
                              key={prop}
                              className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                                isReq
                                  ? 'border border-thread/30 bg-thread/10 text-thread'
                                  : 'border border-dust/15 bg-surface-raised text-dust'
                              }`}
                            >
                              {prop}: {type}
                              {isReq && '*'}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
