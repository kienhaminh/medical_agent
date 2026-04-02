"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, User, Search, Activity, Grid3x3, List, Filter, X } from "lucide-react";
import { PatientCreateDialog } from "./patient-create-dialog";
import { PatientCard } from "./patient-card";
import { usePatientsPage } from "./use-patients-page";

export default function PatientsPage() {
  const {
    patients,
    filteredPatients,
    loading,
    isCreating,
    setIsCreating,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    showFilters,
    setShowFilters,
    genderFilter,
    setGenderFilter,
    sortBy,
    setSortBy,
    activeFilterCount,
    loadPatients,
  } = usePatientsPage();

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold flex items-center gap-3">
                <div className="w-1 h-10 bg-primary rounded-full" />
                Patient Records
              </h1>
              <p className="text-muted-foreground mt-1">Manage and view patient medical records</p>
            </div>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Patient
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by name, DOB, or gender..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={`gap-2 ${showFilters ? "bg-primary/10 text-primary" : ""}`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-primary text-primary-foreground text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </div>

            {showFilters && (
              <Card className="p-4 bg-card/50 border-border/50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-sm">Filter Options</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setGenderFilter("all"); setSortBy("name"); }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear All
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Gender</Label>
                    <Select value={genderFilter} onValueChange={setGenderFilter}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Genders</SelectItem>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Sort By</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name (A-Z)</SelectItem>
                        <SelectItem value="dob">Date of Birth</SelectItem>
                        <SelectItem value="recent">Recently Added</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="space-y-4 text-center">
              <div className="inline-flex p-4 rounded-full bg-primary/10 animate-pulse">
                <Activity className="w-8 h-8 text-primary" />
              </div>
              <p className="text-muted-foreground">Loading patients...</p>
            </div>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-4">
              <div className="inline-flex p-6 rounded-full bg-muted/50 relative overflow-hidden group">
                <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <User className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold mb-2">
                  {searchQuery ? "No patients found" : "No patients yet"}
                </h2>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  {searchQuery
                    ? `No results for "${searchQuery}". Try a different search.`
                    : "Get started by adding your first patient to the system."}
                </p>
              </div>
              {!searchQuery && (
                <Button onClick={() => setIsCreating(true)} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Patient
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-muted-foreground">
                Showing {filteredPatients.length} of {patients.length} patients
              </p>
              <div className="flex items-center gap-2 bg-card/50 border border-border/50 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className={`h-8 px-3 ${viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Grid3x3 className="w-4 h-4 mr-1.5" />
                  Grid
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className={`h-8 px-3 ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <List className="w-4 h-4 mr-1.5" />
                  List
                </Button>
              </div>
            </div>

            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-3"}>
              {filteredPatients.map((patient) => (
                <PatientCard key={patient.id} patient={patient} viewMode={viewMode} />
              ))}
            </div>
          </>
        )}
      </div>

      <PatientCreateDialog
        open={isCreating}
        onClose={() => setIsCreating(false)}
        onCreated={loadPatients}
      />
    </div>
  );
}
