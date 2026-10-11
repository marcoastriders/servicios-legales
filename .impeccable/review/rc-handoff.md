# RC refinement handoff

Base: 5400245bcdf361f8c79df5c5f43a2e90d5f726e1. Worktree: /home/hermes/.hermes/cache/scratch/rc-impeccable.

Preserves rc-* composition and existing paper/ink/serif identity. PRODUCT.md, DESIGN.md and the build-mjs surface brief belong to BurofaxLegal and were not adopted or edited. Backend, Stripe links, nginx, shared styles and Burofax content unchanged. No commit/push/deploy, real intake submission or payment.

Changes: RC-only stylesheet, no kickers, readable brass, flow-based consent plus preference reopening, succinct pricing introduction, payment above tier details, grouped extras/services, coherent online-payment vs prior-consultation instructions, contract-by-email and 30-character help, query package preservation without trusting a payment query.

Verification: node --check build.mjs; build; verify.mjs PUERTA SUPERADA; analytics mocks passed (supports multiple document click listeners and URLSearchParams); RC isolation gate passed against 31 SHA256 hashes of all generated sibling files and original shared assets. 17 sitemap routes / 18 HTML incl 404.

Browser: two bounded rounds, 51 route/viewport renders each at 1440,390,820 x844. Final round: no body overflow; no button/nav/summary targets under 44px; applied target sheet on all routes; no page errors. Consent static and hidden after both reject/accept, persistence across reload, reopen focus analytics-accept. Package Professional survives query; pago=confirmado does not announce verified payment. Pricing focus outline solid 3px. CSS zoom 200% tested on pricing only (not an OS/device-scale simulation), no overflow. See rc-qa-results.json. First round found service prose flex overflow; resolved with explicit bounded width. First paid CTA mobile y832.906 vs previously reported y1446 (banner still visible); target height53.922. Desktop y750.906; intermediate y615.266. No consent/CTA overlap because consent is in flow. Contrast calculation of primary tokens in rc-contrast.json: brass/paper5.91; muted/paper5.92; ink/paper13.00; white/action11.63. Not an exhaustive pixel-level audit of every text state.

15 final full-page screenshots: home, prices, intake, arras service, conditions at all three widths.

Detector: run once on finished RC HTML (not CSS), rc-detector.json. 234 findings: colors120, cramped-padding63, cream-palette18, dark-glow18, radius13, cadence1, em-dash1. Color/radius comparisons use the BF-only DESIGN.md and are not an RC contract. Cream palette is pinned incumbent identity. Static-file detector cannot be treated as browser truth for absolute /assets links; its reported no-padding CTA contradicts target styles loaded in real HTTP browser QA. No clean-detector claim. Existing source-copy cadence retained; independent parent reviewer must triage findings against rendered evidence, not automatically replace the RC identity. DESIGN sidecar stale was reported by context; left untouched (BF-owned); parent documenter may refresh separately if authorized.

Pending: fresh parent finish review and documenter; full zoom/contrast/screen-reader review beyond recorded checks; no sample legal deliverable until Carla review.

Rerun QA: npm install playwright in an external scratch directory, then PLAYWRIGHT_MODULE=/absolute/path/node_modules/playwright/index.mjs node scripts/qa-rc-polish.mjs. Script serves RC and shared dist/assets over one local HTTP origin and blocks all external requests.
