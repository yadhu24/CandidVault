interface Props {
  params: Promise<{ id: string }>
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  return (
    <div>
      <h1 className="text-2xl font-bold">Event {id}</h1>
      {/* TODO: load event, list media, moderate, export */}
    </div>
  )
}
