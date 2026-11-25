import Link from "next/link";
import { StateCard } from "@/components/desk-states";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <StateCard title="Nothing at this address" body="Cautio has one desk and one explainer. The demo starts at Rua Harmonia 302.">
      <Button asChild>
        <Link href="/?lease=rua-harmonia-302">Back to Rua Harmonia 302</Link>
      </Button>
    </StateCard>
  );
}
