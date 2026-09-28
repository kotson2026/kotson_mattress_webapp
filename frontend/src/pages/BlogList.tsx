import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, ArrowRight, BookOpen, Loader2, X } from "lucide-react";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import CustomerSupportCta from "@/components/home/CustomerSupportCta";
import { apiGet } from "@/lib/api";
import type { BlogListResponse } from "@/lib/types";
import { Input } from "@/components/ui/input";

export default function BlogList() {
  const [selectedTag, setSelectedTag] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Set page title & meta description
  useEffect(() => {
    document.title = "Kotson Sleep Journal | Insights, Research & Restorative Science";
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute(
      "content",
      "Better sleep starts with better knowledge. Explore thoughtful sleep research, ergonomic mattress guides, and botanical latex insights from Kotson Naturals."
    );
  }, []);

  const { data, isLoading } = useQuery<BlogListResponse>({
    queryKey: ["public-blogs", selectedTag, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedTag !== "ALL") params.set("tag", selectedTag);
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      params.set("limit", "24");
      return apiGet<BlogListResponse>(`/blogs?${params.toString()}`);
    },
  });

  const blogs = data?.items || [];
  const featuredBlog = blogs.length > 0 && selectedTag === "ALL" && !debouncedSearch ? blogs[0] : null;
  const standardBlogs = featuredBlog ? blogs.slice(1) : blogs;

  // Extract real tags from fetched blogs
  const realTags = Array.from(
    new Set(blogs.flatMap((b) => b.tags || []).filter(Boolean))
  );
  const availableTags = ["ALL", ...realTags];

  return (
    <div className="min-h-svh bg-[#F7F4EE] text-[#2D2D2D] flex flex-col justify-between selection:bg-[#7C9C59]/20">
      <StorefrontHeader />

      <main className="flex-1">
        {/* 12. BLOG LISTING HEADER */}
        <section className="relative px-4 pt-12 pb-10 sm:px-6 sm:pt-16 sm:pb-14 lg:px-8 border-b border-[#EAE4D9]/80">
          <div className="mx-auto max-w-3xl text-center">
            {/* Top Eyebrow */}
            <div className="flex items-center justify-center gap-3 mb-4 sm:mb-5" aria-hidden="true">
              <span className="w-8 sm:w-10 h-px bg-[#7C9C59]/40" />
              <span className="font-ui text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#7C9C59]">
                KOTSON JOURNAL
              </span>
              <span className="w-8 sm:w-10 h-px bg-[#7C9C59]/40" />
            </div>

            {/* Heading */}
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-normal text-[#163D32] tracking-tight leading-[1.12]">
              Better Sleep Starts With
              <br />
              Better Knowledge
            </h1>

            {/* Short Supporting Copy */}
            <p className="mt-4 font-ui text-sm sm:text-base text-[#6B716C] leading-relaxed max-w-xl mx-auto">
              Insights, clinical research, and thoughtful guides from Kotson Naturals to help you understand sleep physiology, botanical latex craftsmanship, and restorative rest.
            </p>

            {/* Search Input */}
            <div className="mt-8 max-w-md mx-auto relative">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-[#6B716C]/60" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sleep topics, guides, materials…"
                className="pl-11 pr-10 min-h-12 rounded-full border-[#EAE4D9] bg-white text-sm shadow-2xs focus-visible:ring-[#467065]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-3.5 text-[#6B716C]/60 hover:text-[#163D32]"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Tag Pills (derived from real published blog tags) */}
            {availableTags.length > 1 && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className={`rounded-full px-4 py-1.5 font-ui text-xs font-medium transition-all cursor-pointer ${
                      selectedTag === tag
                        ? "bg-[#163D32] text-white shadow-2xs"
                        : "bg-white border border-[#EAE4D9] text-[#6B716C] hover:border-[#467065] hover:text-[#163D32]"
                    }`}
                  >
                    {tag === "ALL" ? "All Stories" : tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Content Section */}
        <section className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="flex min-h-[340px] items-center justify-center text-sm font-ui text-[#6B716C]">
              <Loader2 className="h-6 w-6 animate-spin text-[#467065] mr-2.5" />
              Loading stories…
            </div>
          ) : blogs.length === 0 ? (
            /* Empty State */
            <div className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#EAE4D9] bg-white p-10 text-center max-w-md mx-auto shadow-2xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#7C9C59]/15 text-[#163D32] mb-3.5">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-normal text-[#163D32]">No stories found</h3>
              <p className="mt-2 font-ui text-xs sm:text-sm text-[#6B716C] leading-relaxed">
                {debouncedSearch
                  ? `No stories matched "${debouncedSearch}". Try another search term or filter.`
                  : "We are currently drafting new research articles. Please check back soon!"}
              </p>
              {(debouncedSearch || selectedTag !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedTag("ALL");
                  }}
                  className="mt-4 font-ui text-xs font-bold text-[#467065] hover:underline underline-offset-4 cursor-pointer"
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-12 sm:space-y-16">
              {/* FEATURED / LATEST ARTICLE CARD (Desktop: Image left ~58%, content right ~42%) */}
              {featuredBlog && (
                <div className="overflow-hidden rounded-2xl sm:rounded-[24px] border border-[#EAE4D9]/80 bg-white shadow-2xs hover:shadow-xs transition-all duration-300">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-center">
                    <div className="lg:col-span-7 relative aspect-16/10 sm:aspect-16/9 lg:aspect-auto lg:h-full overflow-hidden bg-[#EAE4D9]/30">
                      <Link to={`/blogs/${featuredBlog.slug}`} className="block h-full w-full">
                        <img
                          src={featuredBlog.cover_image || "https://cdn.phototourl.com/member/2026-09-26-af7dc6e9-091c-496e-ad79-c5638c2915e1.png"}
                          alt={featuredBlog.title}
                          className="h-full w-full object-cover transition-transform duration-700 ease-out hover:scale-103"
                        />
                      </Link>
                    </div>

                    <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between h-full">
                      <div>
                        {featuredBlog.tags && featuredBlog.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3.5">
                            <span className="rounded-full bg-[#7C9C59]/15 px-3 py-0.5 font-ui text-[11px] font-semibold text-[#163D32]">
                              {featuredBlog.tags[0]}
                            </span>
                          </div>
                        )}

                        <h2 className="font-display text-2xl sm:text-3xl lg:text-[32px] font-normal text-[#163D32] tracking-tight leading-[1.2]">
                          <Link
                            to={`/blogs/${featuredBlog.slug}`}
                            className="hover:text-[#467065] transition-colors"
                          >
                            {featuredBlog.title}
                          </Link>
                        </h2>

                        <p className="mt-3.5 font-ui text-sm sm:text-[15px] text-[#6B716C] leading-relaxed line-clamp-3">
                          {featuredBlog.excerpt}
                        </p>
                      </div>

                      <div className="mt-8 pt-5 border-t border-[#EAE4D9] flex items-center justify-between font-ui text-xs">
                        <div className="text-[#6B716C]">
                          <span>
                            {featuredBlog.published_at
                              ? new Date(featuredBlog.published_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : ""}
                          </span>
                          <span className="mx-1.5 opacity-50">•</span>
                          <span>{featuredBlog.author_name || "Kotson Team"}</span>
                        </div>

                        <Link
                          to={`/blogs/${featuredBlog.slug}`}
                          className="inline-flex items-center gap-1.5 font-bold text-[#467065] hover:text-[#163D32] transition-colors group"
                        >
                          READ STORY
                          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* LATEST STORIES (3-column desktop, 2-column tablet, 1-column mobile) */}
              {standardBlogs.length > 0 && (
                <div>
                  {featuredBlog && (
                    <div className="mb-8 pb-3 border-b border-[#EAE4D9]/80 flex items-center justify-between">
                      <h3 className="font-ui text-xs font-bold uppercase tracking-[0.18em] text-[#163D32]">
                        LATEST STORIES
                      </h3>
                      <span className="font-ui text-xs text-[#6B716C]">
                        {standardBlogs.length} {standardBlogs.length === 1 ? "article" : "articles"}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                    {standardBlogs.map((b) => (
                      <article
                        key={b.id}
                        className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#EAE4D9]/80 bg-white p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all duration-300"
                      >
                        <div>
                          {/* Image: rounded 18-22px, scale 1.03 on hover */}
                          <Link
                            to={`/blogs/${b.slug}`}
                            className="block relative aspect-16/10 overflow-hidden rounded-[18px] bg-[#EAE4D9]/30 mb-4"
                          >
                            <img
                              src={b.cover_image || "https://cdn.phototourl.com/member/2026-09-26-af7dc6e9-091c-496e-ad79-c5638c2915e1.png"}
                              alt={b.title}
                              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-103"
                              loading="lazy"
                            />
                          </Link>

                          {/* Category / Date */}
                          <div className="flex items-center gap-2 mb-2 font-ui text-[11px]">
                            {b.tags && b.tags.length > 0 && (
                              <span className="font-bold uppercase tracking-wider text-[#7C9C59]">
                                {b.tags[0]}
                              </span>
                            )}
                            {b.published_at && (
                              <>
                                <span className="opacity-40">•</span>
                                <time className="text-[#6B716C]" dateTime={b.published_at}>
                                  {new Date(b.published_at).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </time>
                              </>
                            )}
                          </div>

                          {/* Title: Serif, approx 24-28px desktop */}
                          <h3 className="font-display text-xl sm:text-2xl font-normal text-[#163D32] tracking-tight leading-snug line-clamp-2 group-hover:text-[#467065] transition-colors">
                            <Link to={`/blogs/${b.slug}`}>{b.title}</Link>
                          </h3>

                          {/* Excerpt: 2-3 lines */}
                          <p className="mt-2.5 font-ui text-xs sm:text-sm text-[#6B716C] leading-relaxed line-clamp-3">
                            {b.excerpt}
                          </p>
                        </div>

                        {/* Read Story CTA */}
                        <div className="mt-6 pt-3.5 border-t border-[#EAE4D9]/80 flex items-center justify-between font-ui text-xs">
                          <span className="text-[#6B716C]">
                            By {b.author_name || "Kotson Team"}
                          </span>

                          <Link
                            to={`/blogs/${b.slug}`}
                            className="inline-flex items-center gap-1 font-bold text-[#467065] group-hover:text-[#163D32] transition-colors"
                          >
                            READ STORY
                            <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Global Need Help Choosing Support Section */}
        <CustomerSupportCta />
      </main>

      <SiteFooter />
    </div>
  );
}
