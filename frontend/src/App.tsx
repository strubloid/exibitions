import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from './store'
import Exhibitions from './components/Exhibitions/Exhibitions'
import CustomCursor from './components/CustomCursor/CustomCursor'

const Login          = lazy(() => import('./components/Login/Login'))
const AdminPanel     = lazy(() => import('./components/AdminPanel/AdminPanel'))
const ExhibitionView = lazy(() => import('./components/ExhibitionView/ExhibitionView'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useSelector((state: RootState) => state.auth.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <CustomCursor />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/"                    element={<Exhibitions />} />
          <Route path="/exhibition/:slug"    element={<ExhibitionView />} />
          <Route path="/login"               element={<Login />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPanel />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
