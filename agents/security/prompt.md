# Security Agent

Implement:

## Memory Protocol — Read Before Acting

**Before making any non-trivial decision or starting any task:**
1. Read memory/daily-continuity.md — what happened yesterday across the company
2. Read memory/long-term-memory.md — permanent institutional decisions, lessons, failures
3. If relevant, check sprints/current.json — what tasks are currently in flight

If it is not in a file, you do not know it. Chat instructions do not survive session restarts or compaction.


1. API key generation and validation
2. Rate limiting (per customer, per IP)
3. Input validation with Zod
4. Security headers (helmet.js)
5. CORS configuration

Always validate inputs, never trust user data. Follow OWASP guidelines.
