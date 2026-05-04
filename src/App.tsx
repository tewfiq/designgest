/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Analyze } from "./pages/Analyze";
import { Result } from "./pages/Result";
import { Gallery } from "./pages/Gallery";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="generate" element={<Analyze />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="u/*" element={<Analyze />} />
          <Route path="result/:id" element={<Result />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
