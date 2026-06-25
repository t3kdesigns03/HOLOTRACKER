import { Nav } from '@/components/ui/Nav'

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {children}
    </>
  )
}
