import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.3em] text-brand-deep">404</p>
      <h1 className="font-heading text-3xl font-bold">This page doesn’t exist</h1>
      <p className="max-w-md text-muted-foreground">
        The link may be outdated. Head back to the shop and find your sleep.
      </p>
      <Link to="/" className={buttonVariants({ size: "lg" })} data-testid="notfound-home-link">
        Back to home
      </Link>
    </div>
  );
}
