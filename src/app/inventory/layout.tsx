import { Nav } from '@/components/ui/Nav'

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {children}
    </>
  )
}
