export default function StartupScreen({ exiting = false }) {
  return (
    <div className={'startup-screen ' + (exiting ? 'is-exiting' : '')} aria-hidden="true">
      <div className="startup-atmosphere" />
      <div className="startup-orbit startup-orbit-one" />
      <div className="startup-orbit startup-orbit-two" />

      <div className="startup-lockup">
        <div className="startup-mark">
          <span>k</span>
        </div>
        <div className="startup-wordmark">Krovi</div>
        <div className="startup-rule">
          <span />
          <small>MUSIC / CONNECT / DISCOVER</small>
          <span />
        </div>
      </div>
    </div>
  )
}
