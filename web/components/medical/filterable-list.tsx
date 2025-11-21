"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Filter, X, Grid3x3, List } from "lucide-react";

interface FilterableListProps<T> {
  items: T[];
  renderGridItem: (item: T) => React.ReactNode;
  renderListItem: (item: T) => React.ReactNode;
  searchFields: (keyof T)[];
  filterOptions?: {
    label: string;
    field: keyof T;
    options: { value: string; label: string }[];
  }[];
  sortOptions: {
    value: string;
    label: string;
    compareFn: (a: T, b: T) => number;
  }[];
  emptyMessage?: string;
}

export function FilterableList<T extends Record<string, any>>({
  items,
  renderGridItem,
  renderListItem,
  searchFields,
  filterOptions = [],
  sortOptions,
  emptyMessage = "No items found",
}: FilterableListProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState(sortOptions[0]?.value || "");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filteredItems, setFilteredItems] = useState<T[]>(items);

  useEffect(() => {
    let result = [...items];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) =>
        searchFields.some((field) => {
          const value = item[field];
          return value && String(value).toLowerCase().includes(query);
        })
      );
    }

    // Apply filters
    Object.entries(filters).forEach(([field, value]) => {
      if (value && value !== "all") {
        result = result.filter((item) => item[field] === value);
      }
    });

    // Apply sorting
    const sortOption = sortOptions.find((opt) => opt.value === sortBy);
    if (sortOption) {
      result.sort(sortOption.compareFn);
    }

    setFilteredItems(result);
  }, [searchQuery, filters, sortBy, items, searchFields, sortOptions]);

  const activeFilterCount = Object.values(filters).filter(
    (v) => v && v !== "all"
  ).length + (sortBy !== sortOptions[0]?.value ? 1 : 0);

  const clearFilters = () => {
    setFilters({});
    setSortBy(sortOptions[0]?.value || "");
  };

  return (
    <div className="space-y-4">
      {/* Search and Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="medical-input pl-10"
          />
        </div>
        {filterOptions.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`secondary-button gap-2 ${showFilters ? "bg-cyan-500/10 text-cyan-500" : ""}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 bg-cyan-500 text-white text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && filterOptions.length > 0 && (
        <Card className="p-4 bg-card/50 border-border/50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm">Filter Options</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3 mr-1" />
              Clear All
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filterOptions.map((filterOpt) => (
              <div key={String(filterOpt.field)} className="space-y-2">
                <Label className="text-xs text-muted-foreground">{filterOpt.label}</Label>
                <Select
                  value={filters[String(filterOpt.field)] || "all"}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, [String(filterOpt.field)]: value }))
                  }
                >
                  <SelectTrigger className="medical-input h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filterOpt.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="medical-input h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredItems.length} of {items.length} items
        </p>

        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-card/50 border border-border/50 rounded-lg p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("grid")}
            className={`h-8 px-3 ${
              viewMode === "grid"
                ? "bg-gradient-to-r from-cyan-500/10 to-teal-500/10 text-cyan-500"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Grid3x3 className="w-4 h-4 mr-1.5" />
            Grid
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("list")}
            className={`h-8 px-3 ${
              viewMode === "list"
                ? "bg-gradient-to-r from-cyan-500/10 to-teal-500/10 text-cyan-500"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="w-4 h-4 mr-1.5" />
            List
          </Button>
        </div>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">{emptyMessage}</p>
            {(searchQuery || activeFilterCount > 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  clearFilters();
                }}
                className="secondary-button mt-4"
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              : "space-y-3"
          }
        >
          {filteredItems.map((item, index) =>
            viewMode === "grid" ? (
              <div key={index}>{renderGridItem(item)}</div>
            ) : (
              <div key={index}>{renderListItem(item)}</div>
            )
          )}
        </div>
      )}
    </div>
  );
}
