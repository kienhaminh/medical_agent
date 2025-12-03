"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPatients, createPatient, type Patient } from "@/lib/api";
import { getAllMockPatients } from "@/lib/mock-data";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  User,
  Search,
  Calendar,
  Activity,
  ArrowRight,
  Grid3x3,
  List,
  Filter,
  X,
} from "lucide-react";

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newPatient, setNewPatient] = useState({
    name: "",
    dob: "",
    gender: "",
  });

  // View and filter states
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    let filtered = [...patients];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.dob.includes(query) ||
          p.gender.toLowerCase().includes(query)
      );
    }

    // Apply gender filter
    if (genderFilter !== "all") {
      filtered = filtered.filter((p) => p.gender === genderFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "dob":
          return new Date(a.dob).getTime() - new Date(b.dob).getTime();
        case "recent":
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        default:
          return 0;
      }
    });

    setFilteredPatients(filtered);
  }, [searchQuery, patients, genderFilter, sortBy]);

  async function loadPatients() {
    setLoading(true);
    try {
      // Try to fetch from API, fallback to mock data
      try {
        const data = await getPatients();
        setPatients(data);
        setFilteredPatients(data);
      } catch (apiError) {
        // Use mock data if API fails
        console.log("Using mock patient data");
        const mockData = getAllMockPatients();
        setPatients(mockData);
        setFilteredPatients(mockData);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createPatient(newPatient);
      setIsCreating(false);
      setNewPatient({ name: "", dob: "", gender: "" });
      loadPatients();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold flex items-center gap-3">
                <div className="w-1 h-10 bg-gradient-to-b from-cyan-500 to-teal-500 rounded-full" />
                Patient Records
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage and view patient medical records
              </p>
            </div>
            <Button
              onClick={() => setIsCreating(true)}
              className="primary-button"
            >
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
                  className="medical-input pl-10"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={`secondary-button gap-2 ${
                  showFilters ? "bg-cyan-500/10 text-cyan-500" : ""
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {(genderFilter !== "all" || sortBy !== "name") && (
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-cyan-500 text-white text-xs"
                  >
                    {(genderFilter !== "all" ? 1 : 0) +
                      (sortBy !== "name" ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <Card className="p-4 bg-card/50 border-border/50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-sm">
                    Filter Options
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setGenderFilter("all");
                      setSortBy("name");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear All
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Gender
                    </Label>
                    <Select
                      value={genderFilter}
                      onValueChange={setGenderFilter}
                    >
                      <SelectTrigger className="medical-input h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Genders</SelectItem>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Sort By
                    </Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="medical-input h-9">
                        <SelectValue />
                      </SelectTrigger>
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
              <div className="inline-flex p-4 rounded-full bg-cyan-500/10 animate-pulse">
                <Activity className="w-8 h-8 text-cyan-500" />
              </div>
              <p className="text-muted-foreground">Loading patients...</p>
            </div>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-4">
              <div className="inline-flex p-6 rounded-full bg-muted/50 relative overflow-hidden group">
                <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <User className="w-12 h-12 text-muted-foreground group-hover:text-cyan-500 transition-colors duration-300" />
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
                <Button
                  onClick={() => setIsCreating(true)}
                  className="primary-button mt-4"
                >
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

            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  : "space-y-3"
              }
            >
              {filteredPatients.map((patient) => (
                <Link key={patient.id} href={`/patient/${patient.id}`}>
                  {viewMode === "grid" ? (
                    <Card className="record-card group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 group-hover:scale-110 transition-transform">
                            <User className="w-6 h-6 text-cyan-500" />
                          </div>
                          <div>
                            <h3 className="font-display text-lg font-semibold group-hover:text-cyan-500 transition-colors">
                              {patient.name}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              Patient ID: #{patient.id}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">DOB:</span>
                          <span className="font-medium">{patient.dob}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={
                              patient.gender === "Male"
                                ? "medical-badge-mri"
                                : patient.gender === "Female"
                                ? "medical-badge-xray"
                                : "medical-badge-text"
                            }
                          >
                            {patient.gender}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Added{" "}
                            {new Date(patient.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </Card>
                  ) : (
                    <Card className="record-card group p-4 hover:scale-[1.01] transition-all">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 group-hover:scale-110 transition-transform flex-shrink-0">
                          <User className="w-5 h-5 text-cyan-500" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-display text-base font-semibold group-hover:text-cyan-500 transition-colors truncate">
                              {patient.name}
                            </h3>
                            <Badge
                              variant="secondary"
                              className={`flex-shrink-0 ${
                                patient.gender === "Male"
                                  ? "medical-badge-mri"
                                  : patient.gender === "Female"
                                  ? "medical-badge-xray"
                                  : "medical-badge-text"
                              }`}
                            >
                              {patient.gender}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <span className="font-medium text-foreground">
                                ID:
                              </span>{" "}
                              #{patient.id}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {patient.dob}
                            </span>
                            <span>
                              Added{" "}
                              {new Date(
                                patient.created_at
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>
                    </Card>
                  )}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create Patient Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Add New Patient
            </DialogTitle>
            <DialogDescription>
              Enter patient information to create a new medical record
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                type="text"
                required
                value={newPatient.name}
                onChange={(e) =>
                  setNewPatient({ ...newPatient, name: e.target.value })
                }
                placeholder="John Doe"
                className="medical-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth *</Label>
              <Input
                id="dob"
                type="date"
                required
                value={newPatient.dob}
                onChange={(e) =>
                  setNewPatient({ ...newPatient, dob: e.target.value })
                }
                className="medical-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender *</Label>
              <Select
                value={newPatient.gender}
                onValueChange={(value) =>
                  setNewPatient({ ...newPatient, gender: value })
                }
              >
                <SelectTrigger id="gender" className="medical-input">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreating(false)}
                className="secondary-button"
              >
                Cancel
              </Button>
              <Button type="submit" className="primary-button">
                <Plus className="w-4 h-4 mr-2" />
                Create Patient
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
