import { Routes, Route } from "react-router-dom";
import BlogManagement from "@/pages/admin/BlogManagement";
import BlogEditor from "@/pages/admin/BlogEditor";

export default function BlogHub() {
  return (
    <Routes>
      <Route index element={<BlogManagement />} />
      <Route path="new" element={<BlogEditor />} />
      <Route path=":id/edit" element={<BlogEditor />} />
    </Routes>
  );
}
