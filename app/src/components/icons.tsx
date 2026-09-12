// 선 기반 20px 아이콘. 디자인 목업과 같은 모양.
interface IconProps { size?: number; strokeWidth?: number }
const wrap = (children: React.ReactNode, { size = 20, strokeWidth = 1.75 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>{children}</svg>
)
export const BackIcon = (p: IconProps) => wrap(<path d="M12 4 L5 10 L12 16" />, p)
export const PlayIcon = (p: IconProps) => wrap(<path d="M6 4 L16 10 L6 16 Z" fill="currentColor" stroke="none" />, p)
export const PauseIcon = (p: IconProps) => wrap(<><path d="M6 4 L6 16" strokeWidth={3} /><path d="M14 4 L14 16" strokeWidth={3} /></>, p)
export const FolderIcon = (p: IconProps) => wrap(<path d="M3 6 L3 15 L17 15 L17 8 L10 8 L8 6 Z" />, p)
export const CheckIcon = (p: IconProps) => wrap(<path d="M4 10.5 L8.5 15 L16 6" />, { strokeWidth: 2.2, ...p })
export const CloseIcon = (p: IconProps) => wrap(<><path d="M5 5 L15 15" /><path d="M15 5 L5 15" /></>, p)
