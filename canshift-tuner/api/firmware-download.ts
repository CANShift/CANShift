export const config = {
  runtime: 'edge',
}

const OWNER = 'tburkhalterr'
const REPO = 'CANShift'

const TAG_RE = /^v?\d+\.\d+\.\d+([.-][a-z0-9.-]+)?$/i
const ASSET_RE = /^[a-z0-9._-]+\.bin$/i

const respond = (status: number, body: string): Response =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  })

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url)
  const tag = url.searchParams.get('tag')
  const asset = url.searchParams.get('asset')

  if (!tag || !TAG_RE.test(tag)) return respond(400, 'bad_tag')
  if (!asset || !ASSET_RE.test(asset)) return respond(400, 'bad_asset')

  const target = `https://github.com/${OWNER}/${REPO}/releases/download/${tag}/${asset}`

  let upstream: Response
  try {
    upstream = await fetch(target, { redirect: 'follow' })
  } catch (err) {
    return respond(502, `upstream_failed: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  if (!upstream.ok || !upstream.body) {
    return respond(upstream.status, `upstream_failed_${upstream.status.toString()}`)
  }

  const passHeaders = new Headers({
    'Content-Type': 'application/octet-stream',
    'Cache-Control': 'public, max-age=3600',
  })
  const length = upstream.headers.get('content-length')
  if (length) passHeaders.set('Content-Length', length)

  return new Response(upstream.body, {
    status: 200,
    headers: passHeaders,
  })
}

export default handler
