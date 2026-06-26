export default function AdminEmailsLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-36 bg-gray-200 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
            <div className="h-5 w-40 bg-gray-200 rounded" />
            <div className="h-4 w-full bg-gray-200 rounded" />
            <div className="h-4 w-3/4 bg-gray-200 rounded" />
            <div className="h-9 w-28 bg-gray-200 rounded-lg mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
