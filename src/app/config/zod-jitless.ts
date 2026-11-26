import { z } from 'zod';

// T-095: the Content-Security-Policy (deploy/security-headers.conf) allows no eval. Zod probes for it with a
// caught `new Function("")`, which the browser still reports as a policy violation; jitless skips the probe and
// the compiled fast path it would enable. Imported first by main.tsx, before any schema parses.
z.config({ jitless: true });
