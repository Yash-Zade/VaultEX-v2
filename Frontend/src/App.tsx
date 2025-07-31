import { Route, Routes } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "./config/wagmi-config"; // wagmi config

// Pages
import IndexPage from "@/pages/index";
import DocsPage from "@/pages/docs";
import PricingPage from "@/pages/pricing";
import BlogPage from "@/pages/blog";
import AboutPage from "@/pages/about";

// Query client instance
const queryClient = new QueryClient();

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route element={<IndexPage />} path="/" />
          <Route element={<DocsPage />} path="/docs" />
          <Route element={<PricingPage />} path="/pricing" />
          <Route element={<BlogPage />} path="/blog" />
          <Route element={<AboutPage />} path="/about" />
        </Routes>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
