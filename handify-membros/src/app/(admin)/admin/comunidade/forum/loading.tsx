export default function AdminForumLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-40 bg-gray-200 rounded" />
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0">
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-56 bg-gray-200 rounded" />
              <div className="h-3 w-36 bg-gray-200 rounded" />
            </div>
            <div className="h-6 w-20 bg-gray-200 rounded-full" />
            <div className="flex gap-2">
              <div className="h-8 w-16 bg-gray-200 rounded-lg" />
              <div className="h-8 w-16 bg-gray-200 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
