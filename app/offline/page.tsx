"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <div className="text-6xl">📵</div>
        <h1 className="text-2xl font-bold text-white">You&apos;re offline</h1>
        <p className="text-slate-400">
          Check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-2 bg-primary text-white rounded-lg font-medium"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
