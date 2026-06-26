export default function AdminAlunaDetalheLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-5 w-24 bg-gray-200 rounded" />
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gray-200 shrink-0" />
        <div className="space-y-2">
          <div className="h-6 w-40 bg-gray-200 rounded" />
          <div className="h-4 w-56 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
            <div className="h-3 w-24 bg-gray-200 rounded" />
            <div className="h-5 w-36 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <div className="h-5 w-28 bg-gray-200 rounded" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 w-full bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
