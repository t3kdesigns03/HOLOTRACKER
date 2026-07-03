import { Nav } from '@/components/ui/Nav'

export default function CasesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {children}
    </>
  )
}
