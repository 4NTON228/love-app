:root {
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-top: env(safe-area-inset-top, 0px);
}

.nav-new {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255,245,247,0.92);
  backdrop-filter: blur(24px) saturate(180%);
  border-top: 0.5px solid var(--border, rgba(200,51,74,0.13));
  display: flex;
  align-items: stretch;
  height: calc(56px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  z-index: 50;
}
