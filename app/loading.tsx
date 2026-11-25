import { DeskSkeleton } from "@/components/desk-states";

// Riso placeholder while the desk loads: flat deep-stock blocks with ink borders,
// faded in once through .cautio-enter. No shimmer, no pulse.
export default function Loading() {
  return <DeskSkeleton />;
}
