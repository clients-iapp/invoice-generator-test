# Time log

Times are local (IST). The brief caps the build at 3 hours.

| Phase                                                                                                                  | Start | End   | Notes                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------- | ----- | ----- | -------------------------------------------------------------------------------------------------------------------------- |
| 1. Project setup                                                                                                       | 10:34 | 10:40 | Next.js 16, TypeScript, Tailwind, Mongoose, Zod, Nodemailer, Vitest 3 (Vitest 5 needs Node 22)                             |
| 2. Money, totals, validation + unit tests                                                                              | 10:40 | 10:42 | Integer cents, BigInt rounding, shared Zod schema                                                                          |
| 3. MongoDB model, API routes, email template + API tests                                                               | 10:42 | 10:46 | In-memory MongoDB for tests, seed script                                                                                   |
| 4-7. Editor, live preview, print, email dialog, design                                                                 | 10:46 | 10:59 | Next 16 Cache Components needed Suspense + connection(); fixed column scrolling and focus timing found in browser testing  |
| 8. QA: browser flow, SMTP sink, axe-core audit, keyboard, XSS, build, fresh-clone test                                 | 10:59 | 11:04 | Fixed a noisy live region and two contrast/keyboard issues found by axe                                                    |
| 9. README, screenshots, final checks                                                                                   | 11:01 | 11:07 |                                                                                                                            |
| 10. QA round 2: independent code + UI review, layout stress test, DB-down and CSRF checks                              | 11:08 | 11:20 | Found overflow with long unbroken text, CSRF via text/plain, header-spoofable rate limit, number parsing and sequence bugs |
| 11. Fixes, custom confirm dialog, delete invoice, new tests (27 → 37), docs                                            | 11:20 | 11:35 | All re-verified in the browser; axe 0 violations; build passes                                                             |
| 12. Email polish: mobile layout, wrapper tables for clients that strip body styles; real SMTP send verified            | 11:38 | 11:58 | Gmail account was rate-limited (454), verified with another SMTP server                                                    |
| 13. QA round 3: regression review, isolated QA database, browser repro of each fix, fresh clone                        | 12:00 | 12:22 | Fixed 7 regressions (kept-alive page state, Esc while sending, swallowed click, parsing messages)                          |
| 14. PDF attachment: react-pdf layout, GET /api/invoices/:id/pdf, attach to emails, tests (37 → 38), real send verified | 12:32 | 12:40 | Pure-JS renderer (no headless Chrome); page numbers dropped after a react-pdf 4.9 render-prop issue                        |
| 15. PDF layout polish (alignment, long labels, footer); delete from the invoice list with confirm dialog               | 12:41 | 13:03 | Verified on an isolated QA database; axe 0 violations                                                                      |
| 16. Keyboard shortcuts (N, Ctrl/⌘+S, Ctrl/⌘+Enter) with tooltips and on-screen hint                                    | 13:05 | 13:06 | Tested in the browser on an isolated QA database; axe 0 violations                                                         |

Before the build (about 15 minutes): reviewed the brief, picked a stack, and started a Laravel setup before switching to Next.js + MongoDB.
