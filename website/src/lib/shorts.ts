export type ShortVideo = {
  youtubeId: string
  title: string
}

export function visibleShorts(videos: readonly ShortVideo[]) {
  return videos.filter((video) => video.youtubeId.trim().length > 0)
}

export function shortEmbedUrl(youtubeId: string) {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?rel=0`
}
