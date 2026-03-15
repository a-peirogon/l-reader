import { useRef, useCallback } from 'react'

interface ResizerProps {
  onResize: (width: number) => void
  containerRef: React.RefObject<HTMLDivElement>
}

export function Resizer({ onResize, containerRef }: ResizerProps) {
  const active = useRef(false)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      active.current = true
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'

      const onMove = (ev: MouseEvent) => {
        if (!active.current || !containerRef.current) return
        const containerLeft = containerRef.current.getBoundingClientRect().left
        const w = ev.clientX - containerLeft - 10
        if (w >= 220 && w <= 480) onResize(w)
      }

      const onUp = () => {
        active.current = false
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [onResize, containerRef]
  )

  return (
    <div
      onMouseDown={onMouseDown}
      className="relative z-10 w-[6px] flex-shrink-0 cursor-col-resize"
    >
      <div className="absolute inset-y-0 -left-[2px] -right-[2px]" />
    </div>
  )
}
