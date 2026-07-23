import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { PublicLayout } from "@/components/layout/PublicLayout";
import Home from "./pages/Home";
import Catalog from "./pages/Catalog";
import RentalHouse from "./pages/RentalHouse";
import SuperStore from "./pages/SuperStore";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Contact from "./pages/Contact";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminSetup from "./pages/admin/AdminSetup";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminTags from "./pages/admin/AdminTags";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminBlog from "./pages/admin/AdminBlog";
import AdminHero from "./pages/admin/AdminHero";
import AdminProjects from "./pages/admin/AdminProjects";
import AdminStoreProducts from "./pages/admin/AdminStoreProducts";
import AdminStoreCategories from "./pages/admin/AdminStoreCategories";
import AdminStoreTags from "./pages/admin/AdminStoreTags";
import AdminFinance from "./pages/admin/AdminFinance";
import AdminOwnerProfile from "./pages/admin/AdminOwnerProfile";
import AdminOperations from "./pages/admin/AdminOperations";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Avoid duplicate fetches & flashes when navigating between pages.
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/rental" element={<RentalHouse />} />
                <Route path="/store" element={<SuperStore />} />
                <Route path="/super-store" element={<SuperStore />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:slug" element={<ProjectDetail />} />
                <Route path="/catalog" element={<Catalog />} />
                <Route path="/product/:slug" element={<ProductDetail />} />
                {/* Clean SEO-friendly URL aliases */}
                <Route path="/rental/:slug" element={<ProductDetail />} />
                <Route path="/super-store/:slug" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
                <Route path="/contact" element={<Contact />} />
              </Route>
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/setup" element={<AdminSetup />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="bookings" element={<AdminBookings />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="tags" element={<AdminTags />} />
                <Route path="customers" element={<AdminCustomers />} />
                <Route path="hero" element={<AdminHero />} />
                <Route path="site-projects" element={<AdminProjects />} />
                <Route path="store-products" element={<AdminStoreProducts />} />
                <Route path="store-categories" element={<AdminStoreCategories />} />
                <Route path="store-tags" element={<AdminStoreTags />} />
                <Route path="blog" element={<AdminBlog />} />
                <Route path="finance" element={<AdminFinance />} />
                <Route path="finance/owners/:id" element={<AdminOwnerProfile />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
