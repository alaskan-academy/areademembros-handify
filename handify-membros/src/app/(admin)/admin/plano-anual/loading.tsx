export default function AdminPlanoAnualLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-7 w-40 bg-gray-200 rounded" />
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-32 bg-gray-200 rounded" />
            <div className="h-10 w-full bg-gray-200 rounded-lg" />
          </div>
        ))}
        <div className="h-10 w-32 bg-gray-200 rounded-lg mt-2" />
      </div>
    </div>
  );
}
