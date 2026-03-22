export type Source = {
  id: string
  name: string
  url: string | null
  type: string
  enabled: boolean
  packId: string | null
  description?: string | null
}

export type Pack = {
  id: string
  name: string
  description: string | null
  sourceCount: number
  itemCount: number
  latestItem: string | null
}
