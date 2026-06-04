export const HOME_STYLES = `
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeInLeft {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}
.home-card-link {
  text-decoration: none;
  display: block;
}
.home-card {
  position: relative;
  padding: 32px 28px;
  border-radius: 16px;
  border: 1px solid rgba(90, 21, 21, 0.08);
  background: #ffffff;
  transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  overflow: hidden;
}
.home-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--action), transparent);
  opacity: 0;
  transition: opacity 0.35s ease;
}
.home-card:hover {
  border-color: rgba(90, 21, 21, 0.18);
  box-shadow: 0 8px 32px -8px rgba(90, 21, 21, 0.12), 0 2px 8px -2px rgba(0,0,0,0.04);
  transform: translateY(-3px);
}
.home-card:hover::before { opacity: 1; }
.home-card:hover .home-card-arrow { opacity: 1; transform: translateX(0); }
.home-card-arrow {
  opacity: 0;
  transform: translateX(-6px);
  transition: all 0.3s ease;
}

/* ─── Desktop content (sidebar 제거됨 — 좌측 다크 사이드바가 대체) ─── */
.home-content { padding: 60px 56px; max-width: 980px; margin: 0 auto; }
.home-heading { font-size: 1.8rem; }
.home-sub-text { font-size: 0.85rem; }

/* ─── Mobile ─── */
@media (max-width: 768px) {
  .home-content {
    width: 100% !important;
    margin-left: 0 !important;
    padding: 24px 16px !important;
    overflow-x: hidden !important;
    box-sizing: border-box !important;
  }
  .home-heading {
    font-size: 1.5rem !important;
    word-break: keep-all;
  }
  .home-sub-text {
    font-size: 0.8rem;
    word-break: keep-all;
  }
  .home-card {
    padding: 20px 18px;
    border-radius: 12px;
    width: 100% !important;
    box-sizing: border-box !important;
  }
  .home-card p, .home-card h3 {
    word-break: keep-all;
  }
  .home-page-root {
    overflow-x: hidden !important;
    width: 100vw !important;
    max-width: 100% !important;
  }
}
`;
