"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Image as ImageIcon, Folder, Sparkles } from "lucide-react";
import type { Imaging, ImageGroup } from "@/lib/api";

interface ImageGroupCardProps {
  group: ImageGroup;
  groupImages: Imaging[];
  onClick: () => void;
}

export function ImageGroupCard({ group, groupImages, onClick }: ImageGroupCardProps) {
  const latestImage =
    groupImages.length > 0
      ? groupImages.reduce((latest, current) =>
          new Date(current.created_at) > new Date(latest.created_at) ? current : latest
        )
      : null;

  const uniqueTypes = [...new Set(groupImages.map((img) => img.image_type).filter(Boolean))];

  return (
    <div className="group">
      <Card
        className="cursor-pointer overflow-hidden border border-border/50 hover:border-primary/60 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
        onClick={onClick}
      >
        <div className="aspect-video bg-gradient-to-br from-muted/20 to-muted/10 relative overflow-hidden">
          {latestImage ? (
            <>
              <img
                src={latestImage.preview_url}
                alt={group.name}
                className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted/30 to-muted/10">
              <Folder className="w-16 h-16 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
              <span className="text-xs text-muted-foreground/50 mt-3 font-medium">No images yet</span>
            </div>
          )}

          {/* Bottom content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="space-y-2">
              <h3 className="font-display font-semibold text-white text-lg leading-tight line-clamp-2 drop-shadow-sm">
                {group.name}
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 rounded-md bg-white/20 backdrop-blur-sm">
                    <ImageIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-white/95 text-sm font-medium drop-shadow-sm">
                    {groupImages.length} {groupImages.length === 1 ? "image" : "images"}
                  </span>
                </div>

                {uniqueTypes.length > 0 && (
                  <div className="flex items-center gap-1">
                    {uniqueTypes.slice(0, 3).map((type) => (
                      <Badge
                        key={type}
                        variant={type === "mri" ? "mri" : type === "xray" ? "xray" : "secondary"}
                        className="text-xs px-1.5 py-0.5 font-medium"
                      >
                        {type?.toUpperCase()}
                      </Badge>
                    ))}
                    {uniqueTypes.length > 3 && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0.5 bg-white/20 backdrop-blur-sm text-white border-0 font-medium">
                        +{uniqueTypes.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 flex items-center justify-between bg-card/50 group-hover:bg-card/80 transition-colors border-t border-border/50">
          <div className="text-xs text-muted-foreground/90 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span className="font-medium">
              {new Date(group.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: new Date(group.created_at).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {latestImage && new Date(latestImage.created_at) > new Date(group.created_at) && (
              <div className="text-xs text-muted-foreground/70 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-primary" />
                <span>Updated</span>
              </div>
            )}
            <div className="text-xs font-medium text-muted-foreground/70">{groupImages.length} total</div>
          </div>
        </div>
      </Card>

      {/* Quick stats row */}
      {groupImages.length > 0 && (
        <div className="mt-2 px-1">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground/70">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="truncate">
                {uniqueTypes.length === 1 ? uniqueTypes[0]?.toUpperCase() : `${uniqueTypes.length} types`}
              </span>
            </div>
            <div className="flex items-center gap-2 justify-end text-muted-foreground/70">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span className="truncate">
                {latestImage ? `Recent: ${new Date(latestImage.created_at).toLocaleDateString()}` : "Empty"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
