import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="cautio-enter mx-auto max-w-xl space-y-4 px-4 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Cautio</p>
      <h2 className="riso-overprint font-display text-5xl">Nothing at this address</h2>
      <p className="text-sm text-muted-foreground">
        Cautio has one desk and one explainer. The demo starts at Rua Harmonia 302.
      </p>
      <Button asChild>
        <Link href="/?lease=rua-harmonia-302">Back to Rua Harmonia 302</Link>
      </Button>
    </section>
  );
}
