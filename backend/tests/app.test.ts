// 5. Auth middleware - applies to all routes after this point
// This ensures protected routes require authentication
app.use(authMiddleware);

// 6. Proxy middleware - handles x402 payment requests (protected by auth)
app.use(proxyMiddleware);