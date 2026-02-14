res.end = function (chunk?: any, encoding?: any, cb?: any): Response {
  const responseTimeMs = res.startTime ?