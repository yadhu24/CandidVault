interface Props {
  params: Promise<{ slug: string }>
}

export default async function GuestUploadPage({ params }: Props) {
  const { slug } = await params
  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="text-2xl font-bold">Upload your photos</h1>
      <p className="mt-2 text-sm text-zinc-500">Event: {slug}</p>
      {/* TODO: load event by slug, guest upload form */}
    </main>
  )
}
