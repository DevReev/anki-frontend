// app/review/page.js
import { Suspense } from "react";
import ReviewClient from "./ReviewClient";

export default function ReviewPage() {
  // useSearchParams() inside ReviewClient requires a Suspense boundary
  // when used in a Server Component tree.
  return (
    <Suspense>
      <ReviewClient />
    </Suspense>
  );
}
