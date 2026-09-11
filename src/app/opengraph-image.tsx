import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'CareSanchaar'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 64,
          background: '#08090E',
          color: '#F5F7FA',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <div style={{ color: '#14B8A6', fontSize: 80, fontWeight: 'bold' }}>CareSanchaar</div>
        <div style={{ fontSize: 32, marginTop: 20, color: '#B8BFCC' }}>Care that reaches. Coordination that connects.</div>
      </div>
    ),
    {
      ...size,
    }
  )
}
