import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "./store";
import { hydrate } from "./store/basketSlice";
import Exhibitions from "./components/Exhibitions/Exhibitions";
import Header from "./components/Header/Header";
import BasketDrawer from "./components/BasketDrawer/BasketDrawer";

const Login = lazy(() => import("./components/Login/Login"));
const AdminPanel = lazy(() => import("./components/AdminPanel/AdminPanel"));
const ExhibitionView = lazy(() => import("./components/ExhibitionView/ExhibitionView"));
const CheckoutForm = lazy(() => import("./components/CheckoutForm/CheckoutForm"));
const CheckoutSuccess = lazy(() => import("./components/CheckoutSuccess/CheckoutSuccess"));
const AdminOrders = lazy(() => import("./components/AdminOrders/AdminOrders"));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const token = useSelector((state: RootState) => state.auth.token);
    return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
    const dispatch = useDispatch<AppDispatch>();

    // Hydrate the basket from localStorage on boot.
    useEffect(() => {
        const items = JSON.parse(localStorage.getItem("exibitions_basket") ?? "{\"items\":[]}").items ?? [];
        if (Array.isArray(items) && items.length) dispatch(hydrate(items));
    }, [dispatch]);

    return (
        <BrowserRouter>
            <Header />
            <BasketDrawer />
            <Suspense fallback={null}>
                <Routes>
                    <Route path="/" element={<Exhibitions />} />
                    <Route path="/exhibition/:slug" element={<ExhibitionView />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/checkout" element={<CheckoutForm />} />
                    <Route path="/checkout/success" element={<CheckoutSuccess />} />
                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute>
                                <AdminPanel />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/orders"
                        element={
                            <ProtectedRoute>
                                <AdminOrders />
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
}