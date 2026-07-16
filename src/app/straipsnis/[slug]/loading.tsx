export default function ArticleLoading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center max-w-sm px-4">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-bbc-red border-r-transparent" />
        <p className="mt-4 text-sm text-bbc-black font-medium">
          Kraunamas straipsnis…
        </p>
      </div>
    </div>
  );
}
