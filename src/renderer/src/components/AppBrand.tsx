import pageWing from '../../../../assets/branding/page-wing.png'

export function AppBrand({
  size = 30,
  wordmark = true,
  className = ''
}: {
  size?: number
  wordmark?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <span className={`app-brand ${className}`}>
      <img src={pageWing} width={size} height={size} alt="" aria-hidden="true" draggable={false} />
      {wordmark && <strong className="brand-wordmark">XViewer</strong>}
    </span>
  )
}
