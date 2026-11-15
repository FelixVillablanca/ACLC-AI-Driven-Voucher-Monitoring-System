import { RouterProvider } from 'react-router-dom'
import Providers from '@/app/providers'
import { router } from '@/app/router'
import { useSessionCheck } from '@/features/auth'

export default function App() {
  // On every page load/refresh: "am I still logged in?" (GET /auth/me)
  useSessionCheck()

  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  )
}
