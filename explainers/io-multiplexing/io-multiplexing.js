// Serving many mostly-idle connections: a thread each, one poll() loop, or one epoll loop. A cost model in seconds of CPU
// per second of wall time, with rough but named constants. No DOM.

export const COST = {
  work: 20e-6,          // CPU to handle one request
  switch: 3e-6,         // one context switch (a blocked thread wakes, later sleeps again: two per request)
  syscall: 1e-6,        // fixed cost of one poll() or epoll_wait() call
  perFd: 0.1e-6,        // poll(): the kernel checks every registered descriptor on every call
  perReady: 0.1e-6,     // epoll: cost per descriptor that is actually ready
  threadMem: 80 * 1024, // stack plus kernel structures per thread
  connMem: 1024,        // buffers and bookkeeping per connection in an event loop
};

/**
 * C connections, each sending r requests a second. An event loop handles every ready connection per call, so under load
 * one call's fixed cost is shared by many events: the loop period T satisfies T = s + (events arriving in T) × w.
 * Returns { cpu (0..1, 1 = saturated), overhead (share of CPU not spent on work), latency (s), memory (bytes), overloaded }.
 */
export function model(kind, C, r, c = COST) {
  const E = C * r, work = E * c.work;
  if (kind === "threads") {
    const cpu = E * (c.work + 2 * c.switch);
    return { cpu: Math.min(1, cpu), overhead: E * 2 * c.switch, latency: c.work + c.switch, memory: C * c.threadMem, overloaded: cpu > 1 };
  }
  const s = c.syscall + (kind === "poll" ? C * c.perFd : 0), w = c.work + (kind === "epoll" ? c.perReady : 0);
  if (E * w >= 1) return { cpu: 1, overhead: NaN, latency: Infinity, memory: C * c.connMem, overloaded: true };
  const alone = E * (s + w);
  if (alone <= 1) return { cpu: alone, overhead: E * s, latency: s + w, memory: C * c.connMem, overloaded: false };
  const T = s / (1 - E * w), calls = 1 / T;           // saturated: busy all the time, batching E·T events per call
  return { cpu: 1, overhead: calls * s, latency: T, memory: C * c.connMem, overloaded: false };
}
export const KINDS = ["threads", "poll", "epoll"];
