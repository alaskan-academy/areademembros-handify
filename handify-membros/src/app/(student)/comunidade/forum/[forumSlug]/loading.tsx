export default function ForumTopicLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse space-y-4">
      <div className="h-5 w-24 bg-gray-200 rounded" />
      <div className="h-7 w-2/3 bg-gray-200 rounded" />
      <div className="h-10 w-full bg-gray-200 rounded-lg mb-6" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gray-200 shrink-0" />
            <div className="space-y-1.5">
              <div className="h-3 w-24 bg-gray-200 rounded" />
              <div className="h-3 w-16 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="h-5 w-3/4 bg-gray-200 rounded" />
          <div className="h-4 w-full bg-gray-200 rounded" />
          <div className="flex gap-3 pt-1">
            <div className="h-3 w-14 bg-gray-200 rounded" />
            <div className="h-3 w-14 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
