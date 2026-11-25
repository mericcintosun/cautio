import { z } from "zod";

/** A lease slug as it appears in `?lease=` and `/api/leases/[id]`, e.g. `rua-harmonia-302`. */
export const leaseSlugSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);
