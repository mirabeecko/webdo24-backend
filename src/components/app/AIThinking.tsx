'use client'

export default function AIThinking() {
  return (
    <div className="flex items-center gap-1.5 h-7 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-gray-300"
          style={{ animation: `aiDotPulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </div>
  )
}
