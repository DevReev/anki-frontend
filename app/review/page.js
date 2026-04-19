// app/review/page.js
import { Suspense } from "react";
import ReviewClient from "./ReviewClient";

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-slate-600">Loading review mode...</p>
          </div>
        </div>
      }
    >
      <ReviewClient />
    </Suspense>
  );
}
